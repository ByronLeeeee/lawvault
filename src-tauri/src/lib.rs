use std::sync::Mutex;
use std::path::PathBuf;
use std::fs;
use tauri::{AppHandle, Emitter, Manager, path::BaseDirectory};
use serde::{Deserialize, Serialize};
use futures::{StreamExt};
use rusqlite::Connection;
// 移除未使用的 RecordBatch 避免警告
use arrow_array::{StringArray, Float32Array}; 
use lancedb::query::{ExecutableQuery, QueryBase};

// --- 1. 数据模型 ---

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppSettings {
    // --- 通用设置 ---
    search_top_k: usize,
    display_density: String, 

    // --- 向量模型设置 (Embedding) ---
    embedding_base_url: String, 
    embedding_api_key: String,  
    embedding_model: String,    

    // --- 数据存储设置 ---
    // 如果为 Some，则使用该路径；如果为 None 或空字符串，使用默认资源路径
    custom_data_path: Option<String>,

    // --- 对话模型设置 (Chat) ---
    enable_ai_chat: bool,
    chat_base_url: String,      
    chat_api_key: String,
    chat_model: String,         
    chat_top_k: usize,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            search_top_k: 50,
            display_density: "comfortable".to_string(),
            custom_data_path: None, // 默认为空，使用本地
            embedding_base_url: "http://localhost:11434/v1".to_string(),
            embedding_api_key: "ollama".to_string(),
            embedding_model: "embeddinggemma:300m".to_string(),

            enable_ai_chat: false,
            chat_base_url: "http://localhost:11434/v1".to_string(),
            chat_api_key: "ollama".to_string(),
            chat_model: "qwen3".to_string(),
            chat_top_k: 5,
        }
    }
}

#[derive(Serialize, Debug)]
struct LawNameSuggestion {
    name: String,
    region: String,
    category: String,
}

// 返回给前端的数据结构
#[derive(Serialize, Debug, Clone)]
struct LawChunk {
    id: String,
    _distance: f32,
    content: String,
    law_name: String,
    category: String,
    publish_date: String,
    part: String,
    chapter: String,
    article_number: String,
    region: String,
    source_file: String,
}

struct AppState {
    settings: Mutex<AppSettings>,
    settings_path: PathBuf,
    app_data_dir: PathBuf,
}

// --- 2. 辅助函数 ---
fn connect_sqlite(data_dir: &std::path::Path) -> Result<Connection, String> {
    let db_path_buf = data_dir.join("content.db");
    let mut path_str = db_path_buf.to_string_lossy().to_string();

    // 关键：去除 Windows 的 \\?\ 前缀
    #[cfg(windows)]
    {
        if path_str.starts_with(r"\\?\") {
            path_str = path_str[4..].to_string();
        }
    }

    Connection::open(path_str).map_err(|e| format!("SQLite connect error: {}", e))
}

fn load_settings_from_disk(path: &PathBuf) -> AppSettings {
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(settings) = serde_json::from_str(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

async fn get_embedding(text: &str, base_url: &str, api_key: &str, model: &str) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::new();
    // 适配 OpenAI 格式路径
    let url = format!("{}/embeddings", base_url.trim_end_matches('/'));
    
    let prompt = text.replace("\n", " ");

    let res = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key)) 
        .json(&serde_json::json!({
            "model": model,
            "input": prompt, 
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Embedding API Error: {} - Check URL/Key", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(data) = json.get("data") {
        if let Some(first) = data.get(0) {
             if let Some(vec) = first.get("embedding") {
                 let embedding: Vec<f32> = vec.as_array()
                    .ok_or("Invalid embedding format")?
                    .iter()
                    .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                    .collect();
                 return Ok(embedding);
             }
        }
    }
    
    if let Some(vec) = json.get("embedding") {
         let embedding: Vec<f32> = vec.as_array()
            .ok_or("Invalid embedding format")?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();
         return Ok(embedding);
    }

    Err("Could not find embedding in response".to_string())
}

// 获取当前生效的数据目录
fn get_effective_data_dir(state: &tauri::State<'_, AppState>) -> PathBuf {
    let settings = state.settings.lock().unwrap();
    
    if let Some(custom_path) = &settings.custom_data_path {
        if !custom_path.trim().is_empty() {
            let path = PathBuf::from(custom_path);
            // 简单的检查：如果该路径存在，就用它
            if path.exists() {
                return path;
            }
        }
    }
    
    // 回退到默认的 app_data_dir (即 exe 同级目录下的 resources/app_data)
    state.app_data_dir.clone()
}


// --- 3. Tauri 命令 ---
#[tauri::command]
fn check_db_status(state: tauri::State<'_, AppState>) -> bool {
    let data_dir = get_effective_data_dir(&state);
    let lancedb_path = data_dir.join("law_db.lancedb");
    // 只要文件夹存在，就认为就绪
    lancedb_path.exists()
}

#[tauri::command]
async fn search_law(
    query: String,
    filter_region: Option<String>, 
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LawChunk>, String> {
    let settings = state.settings.lock().unwrap().clone();
    
    // 【修改】获取实际的数据路径
    let data_dir = get_effective_data_dir(&state);

    // 1. 获取向量 (修复字段名为 embedding_*)
    let vector = get_embedding(
        &query, 
        &settings.embedding_base_url, 
        &settings.embedding_api_key, 
        &settings.embedding_model
    ).await?;

    // 2. 连接数据库
    let lancedb_path_buf = data_dir.join("law_db.lancedb");
    let mut path_str = lancedb_path_buf.to_string_lossy().to_string();
    #[cfg(windows)]
    { if path_str.starts_with(r"\\?\") { path_str = path_str[4..].to_string(); } }
    
    if !lancedb_path_buf.exists() { return Err(format!("数据库路径不存在: {}", path_str)); }

    let db = lancedb::connect(&path_str).execute().await.map_err(|e| format!("Connect error: {}", e))?;
    let table = db.open_table("laws_vectors").execute().await.map_err(|e| format!("Open table error: {}", e))?;

    // 策略：请求 3 倍数据用于后置过滤
    let fetch_limit = settings.search_top_k * 3;

    // 3. 向量搜索
    let results_stream = table
        .query()
        .nearest_to(vector)
        .map_err(|e| format!("Vector query error: {}", e))? // 【修复】这里加了 ? 解包 Result
        .limit(fetch_limit) 
        .execute()
        .await
        .map_err(|e| format!("Search execution error: {}", e))?;

    let mut stream = results_stream; 
    let mut chunk_ids: Vec<String> = Vec::new();
    let mut distances: Vec<f32> = Vec::new();

    // 4. 解析 Arrow 数据
    while let Some(item) = stream.next().await {
        match item {
            Ok(batch) => {
                let id_col = batch.column_by_name("chunk_id").ok_or("Missing chunk_id")?;
                let dist_col = batch.column_by_name("_distance").ok_or("Missing _distance")?;
                let ids = id_col.as_any().downcast_ref::<StringArray>().ok_or("chunk_id not string")?;
                let dists = dist_col.as_any().downcast_ref::<Float32Array>().ok_or("_distance not float")?;
                for i in 0..batch.num_rows() {
                    chunk_ids.push(ids.value(i).to_string());
                    distances.push(dists.value(i));
                }
            }
            Err(e) => return Err(format!("Stream error: {}", e)),
        }
    }

    if chunk_ids.is_empty() { return Ok(Vec::new()); }

    // 5. 查 SQLite
    let conn = connect_sqlite(&data_dir)?;
    let placeholders: String = chunk_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT id, content, law_name, category, region, publish_date, part, chapter, article_number 
         FROM chunks WHERE id IN ({})", 
        placeholders
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params = rusqlite::params_from_iter(chunk_ids.iter());
    
    let chunk_map: std::collections::HashMap<String, LawChunk> = stmt.query_map(params, |row| {
        let id: String = row.get(0)?;
        let law_name: String = row.get(2)?;
        Ok((id.clone(), LawChunk {
            id,
            _distance: 0.0,
            content: row.get(1)?,
            law_name: law_name.clone(),
            category: row.get(3)?,
            region: row.get(4)?,
            publish_date: row.get(5)?,
            part: row.get(6).unwrap_or_default(),
            chapter: row.get(7).unwrap_or_default(),
            article_number: row.get(8)?,
            source_file: format!("{}.txt", law_name),
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(Result::ok)
    .collect();

    // 6. 【补全功能】内存过滤与排序
    let mut final_results = Vec::new();
    for (i, id) in chunk_ids.iter().enumerate() {
        if let Some(mut chunk) = chunk_map.get(id).cloned() {
            chunk._distance = distances[i];
            
            // 核心过滤逻辑 (恢复 Python 版的功能)
            let should_keep = if chunk.category != "地方法规" {
                true
            } else {
                if let Some(ref target_region) = filter_region {
                    // 只要 region 包含目标关键词 (如 "上海") 就保留
                    chunk.region.contains(target_region)
                } else {
                    false // 未指定地区，丢弃所有地方法规
                }
            };

            if should_keep {
                final_results.push(chunk);
            }
        }
    }

    // 7. 截取最终 Top-K
    Ok(final_results.into_iter().take(settings.search_top_k).collect())
}

#[tauri::command]
fn search_law_by_name(
    query: String,
    limit: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LawNameSuggestion>, String> {
    let data_dir = get_effective_data_dir(&state);
    let conn = connect_sqlite(&data_dir)?;

    // 【修改 1】去掉 SQL 里的 LIMIT
    // 我们需要先获取所有匹配项，在内存里排好序，再截取。
    // 否则如果 LIMIT 10，数据库可能随机返回了 10 个不重要的“地方法规”，把“法律”漏掉了。
    // 为了防止匹配太多卡死，可以给一个较大的硬上限，比如 200
    let sql = "SELECT DISTINCT law_name, region, category FROM full_texts WHERE law_name LIKE ? LIMIT 200";
    let query_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    
    let mut suggestions: Vec<LawNameSuggestion> = stmt.query_map(rusqlite::params![query_pattern], |row| {
        Ok(LawNameSuggestion {
            name: row.get(0)?,
            region: row.get(1)?,
            category: row.get(2)?,
        })
    })
    .map_err(|e| e.to_string())?
    .filter_map(Result::ok)
    .collect();

    // 【修改 2】定义优先级辅助函数
    fn get_category_priority(cat: &str) -> i32 {
        match cat {
            "法律" => 1,
            "司法解释" => 2,
            "行政法规" => 3,
            "地方法规" => 4,
            _ => 99,
        }
    }

    // 【修改 3】执行双重排序
    suggestions.sort_by(|a, b| {
        let p_a = get_category_priority(&a.category);
        let p_b = get_category_priority(&b.category);
        
        if p_a != p_b {
            // 1. 先按效力等级排序 (数值越小越靠前)
            p_a.cmp(&p_b)
        } else {
            // 2. 等级相同，按名称长度排序 (越短越靠前，比如 "刑法" < "刑法修正案")
            a.name.len().cmp(&b.name.len())
        }
    });

    // 【修改 4】在排序后进行截取
    if suggestions.len() > limit {
        suggestions.truncate(limit);
    }

    Ok(suggestions)
}

#[tauri::command]
fn get_article_snippet(
    law_name_query: Option<String>, // 如果为 None，表示查本法；如果有值，表示查其他法
    article_number: String,
    current_law_name: String,       // 当前正在阅读的法律名称（用于本法引用）
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let data_dir = get_effective_data_dir(&state);
    let conn = connect_sqlite(&data_dir)?;

    let target_law = match law_name_query {
        Some(name) => name,
        None => current_law_name, // 如果没提取到法名，或者是“本法”，就用当前法名
    };

    // 模糊匹配法条名 (因为引用可能写简称，如"劳动合同法" vs "中华人民共和国劳动合同法")
    // 且匹配条号
    let sql = "SELECT content FROM chunks WHERE law_name LIKE ? AND article_number = ? LIMIT 1";
    let law_pattern = format!("%{}%", target_law);

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt.query(rusqlite::params![law_pattern, article_number]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(row.get(0).map_err(|e| e.to_string())?)
    } else {
        Ok(format!("未找到《{}》的{}", target_law, article_number))
    }
}

#[tauri::command]
async fn check_ai_connection(
    base_url: String,
    api_key: String,
    model: String
) -> Result<String, String> {
    let client = reqwest::Client::new();
    // 标准 OpenAI 协议获取模型列表的路径
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let res = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("连接失败: 网络请求错误 ({})", e))?;

    if !res.status().is_success() {
        return Err(format!("连接失败: 服务器返回状态码 {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| format!("解析失败: {}", e))?;

    // 检查模型是否存在
    // OpenAI 格式通常是 { "data": [ { "id": "model-name", ... } ] }
    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        let model_exists = data.iter().any(|m| {
            m.get("id").and_then(|id| id.as_str()) == Some(&model)
        });

        if model_exists {
            Ok(format!("连接成功！发现模型: {}", model))
        } else {
            // 只是警告，因为有些兼容接口可能不返回完整列表，但仍能用
            Ok(format!("连接通畅，但在列表中未找到模型 '{}' (可能仍可用)", model))
        }
    } else {
        // 非标准格式，只要通了就算成功
        Ok("连接成功！(未能验证模型名称)".to_string())
    }
}

#[tauri::command]
fn get_full_text(
    source_file: String, 
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let data_dir = get_effective_data_dir(&state);
    let conn = connect_sqlite(&data_dir)?;

    let law_name = source_file.trim_end_matches(".txt");
    let sql = "SELECT full_text FROM full_texts WHERE law_name = ?";
    
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt.query(rusqlite::params![law_name]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(row.get(0).map_err(|e| e.to_string())?)
    } else {
        Err("未找到该法条全文".to_string())
    }
}

#[tauri::command]
async fn chat_stream(
    app: AppHandle,
    query: String,
    context_chunks: Vec<String>,
    state: tauri::State<'_, AppState>
) -> Result<(), String> {
    let settings = state.settings.lock().unwrap().clone();
    
    // 使用 settings.chat_top_k 进行截断，节省 token
    let limit = settings.chat_top_k;
    let selected_chunks = if context_chunks.len() > limit {
        &context_chunks[..limit]
    } else {
        &context_chunks[..]
    };

    let context_str = selected_chunks.join("\n\n");
    let system_prompt = format!(
    r#"你是一个法条检索结果的智能分析器。你的任务是评估【用户搜索词】与【检索到的法条】之间的相关性，并根据相关程度输出相应内容。

### 全局约束
1. **非对话模式**：禁止使用“你好”、“建议您”、“抱歉”等聊天用语。
2. **客观陈述**：直接输出分析结果。

### 逻辑判断与输出规则
请先分析【用户搜索词】与【检索到的法条】的语义匹配度，并严格遵守以下三种情况之一进行输出：

#### 情况一：检索结果高度相关（法条能覆盖搜索意图）
- **动作**：对法条内容进行综合归纳。
- **输出格式**：
  **【检索摘要】**：(基于相关的法条内容详细回答用户的问题，不相关的法条请忽略)

#### 情况二：检索结果不相关（法条与搜索意图偏差较大，或过于宽泛）
- **动作**：分析为何不匹配，并给出搜索建议。
- **输出格式**：
  **【检索提示】**：当前检索结果与您的搜索意图关联度较低。
  **【优化建议】**：建议尝试以下关键词句：(列出3-5个更精准的法律专业术语或句子)
  **【搜索方向】**：建议缩小/扩大搜索范围，例如...(简要说明)

#### 情况三：检索结果严重偏离（内容完全风马牛不相及，例如搜“刑法”出来“合同模板”或乱码）
- **动作**：提示技术性检查。
- **输出格式**：
  **【系统提示】**：检索结果与搜索词存在严重的语义断层。
  **【排查建议】**：请检查当前使用的向量模型是否正确。


【检索到的法条】：
{}
"#, 
    context_str
);
    let user_prompt = format!("请分析以下问题：\n{}\n\n请开始分析：", query);

    let client = reqwest::Client::new();
    // 修复：使用 chat_base_url 和 chat_api_key
    let url = format!("{}/chat/completions", settings.chat_base_url.trim_end_matches('/'));

    let mut stream = client.post(&url)
        .header("Authorization", format!("Bearer {}", settings.chat_api_key))
        .json(&serde_json::json!({
            "model": settings.chat_model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": true,
            "temperature": 0.3 
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes_stream();

    while let Some(item) = stream.next().await {
        match item {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if line.starts_with("data: ") {
                        let json_str = line.trim_start_matches("data: ").trim();
                        if json_str == "[DONE]" { break; }
                        
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                            if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                let _ = app.emit("chat-token", content);
                            }
                            else if let Some(content) = json["message"]["content"].as_str() {
                                let _ = app.emit("chat-token", content);
                            }
                        }
                    }
                }
            }
            Err(e) => { let _ = app.emit("chat-token", format!("[Error: {}]", e)); }
        }
    }
    Ok(())
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(new_settings: AppSettings, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.settings.lock().unwrap();
    *guard = new_settings.clone();
    
    let json = serde_json::to_string_pretty(&new_settings).map_err(|e| e.to_string())?;
    // 这里需要用 create 覆盖写入，否则如果新内容比旧内容短，可能会残留
    let _ = fs::write(&state.settings_path, json);
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let resource_path = app.path().resolve("resources/app_data", BaseDirectory::Resource)?;
            
            if !resource_path.exists() {
                eprintln!("严重错误：资源路径不存在 -> {:?}", resource_path);
            }

            let settings_path = resource_path.join("settings.json");
            let settings = if settings_path.exists() {
                load_settings_from_disk(&settings_path)
            } else {
                println!("未找到设置文件，使用默认设置");
                AppSettings::default()
            };

            app.manage(AppState {
                settings: Mutex::new(settings),
                settings_path,
                app_data_dir: resource_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_law,
            chat_stream,
            get_settings,
            save_settings,
            search_law_by_name,
            get_full_text,
            check_ai_connection,
            get_article_snippet,
            check_db_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}