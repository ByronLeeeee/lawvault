use arrow_array::{Float32Array, StringArray};
use futures::StreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};

// ==========================================
// 1. 提示词 (Prompts)
// ==========================================

const PLANNER_PROMPT: &str = r#"
你是法律检索规划专家。将用户问题拆解为向量检索任务清单。

数据库说明：
- 包含法律、行政法规、司法解释、地方法规的条文 Embedding
- 检索方式为语义相似度匹配

拆解原则：

1. 提取核心法律概念
将问题中的关键法律术语提取为检索词。
正确："故意伤害罪的量刑标准"
错误："打人会被判多久"（口语化，相似度低）

2. 分层检索
先查主要法律依据，再查司法解释细则。
示例：["劳动合同解除的法定情形", "解除劳动合同的经济补偿标准"]

3. 避免过度拆解
简单问题1个任务即可，复杂问题不超过5个。
问题："诉讼时效是多久" → ["民事诉讼时效期间"]
问题："房屋买卖合同纠纷如何处理" → ["房屋买卖合同违约责任", "房屋买卖合同解除条件", "房屋买卖纠纷管辖规定"]

4. 使用标准法律术语
用"不当得利"而非"多收的钱要还吗"
用"劳动争议仲裁时效"而非"劳动纠纷多久失效"

输出格式：
仅输出 JSON 数组，不含任何其他内容：
["任务1", "任务2", "任务3"]

用户问题："{user_query}"
"#;

const EXECUTOR_PROMPT: &str = r#"
你是检索结果评估器。评估刚才的向量检索结果，决定是否需要调整后续任务。

上下文：
用户问题："{user_query}"
执行任务："{current_task}"

检索结果：
{search_results}

待办任务：
{remaining_todo_list}

评估流程：

步骤1：判断检索质量
- 高相关：法条直接解答当前任务
- 部分相关：法条提供线索但不完整
- 不相关：检索词可能不准确

步骤2：检查信息完整性
针对用户原始问题，当前信息是否足够给出完整答案？
- 充分：清空待办清单
- 不足：继续执行或调整任务

步骤3：决策

情况A：检索结果不相关
更换更精确的法律术语重新检索。
示例：
"thought": "当前检索词过于宽泛，改用具体罪名检索",
"new_todo_list": ["盗窃罪的立案标准和量刑幅度"]

情况B：发现新的法律适用方向
基于检索到的法条，追加相关任务。
示例：
"thought": "检索到该行为同时触犯民事和刑事责任，需补充刑事部分",
"new_todo_list": ["原任务A", "新增：故意伤害罪的构成要件"]

情况C：信息已充分
示例：
"thought": "已获取合同违约的法律规定和司法解释，足以回答用户问题",
"new_todo_list": []

情况D：删减冗余任务
示例：
"thought": "用户未提及地区且已获得国家层面法律，删除地方法规查询任务",
"new_todo_list": ["保留任务A"]

规则：
1. 不要重复检索相似概念
2. 待办任务总数不超过5个
3. 聚焦用户核心诉求，避免过度检索

输出格式（仅JSON，无其他内容）：
{
  "thought": "50字以内的分析",
  "new_todo_list": ["任务A", "任务B"]
}
"#;

// ==========================================
// 2. 数据结构
// ==========================================
#[derive(Serialize, Deserialize, Debug)]
pub struct UserFolder {
    id: i32,
    name: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub search_top_k: usize,
    pub display_density: String,
    pub embedding_base_url: String,
    pub embedding_api_key: String,
    pub embedding_model: String,
    pub custom_data_path: Option<String>,
    pub enable_ai_chat: bool,
    pub chat_base_url: String,
    pub chat_api_key: String,
    pub chat_model: String,
    pub chat_top_k: usize,
    #[serde(default = "default_max_loops")]
    pub max_agent_loops: i32,
}

fn default_max_loops() -> i32 {
    5
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            search_top_k: 50,
            display_density: "comfortable".to_string(),
            custom_data_path: None,
            embedding_base_url: "http://localhost:11434/v1".to_string(),
            embedding_api_key: "ollama".to_string(),
            embedding_model: "embeddinggemma:300m".to_string(),
            enable_ai_chat: false,
            chat_base_url: "http://localhost:11434/v1".to_string(),
            chat_api_key: "ollama".to_string(),
            chat_model: "qwen3".to_string(),
            chat_top_k: 5,
            max_agent_loops: 5,
        }
    }
}

#[derive(Serialize, Debug)]
struct LawNameSuggestion {
    name: String,
    region: String,
    category: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LawChunk {
    id: String,
    pub _distance: f32,
    pub content: String,
    pub law_name: String,
    category: String,
    publish_date: String,
    part: String,
    chapter: String,
    pub article_number: String,
    region: String,
    source_file: String,
}

// 用户收藏结构体
#[derive(Serialize, Deserialize, Debug)]
pub struct UserFavorite {
    id: i32,
    law_id: String,
    law_name: String,
    article_number: String,
    content: String,
    created_at: String,
    tags: Option<String>,
    folder_id: Option<i32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchHistoryItem {
    id: i32,
    query: String,
    timestamp: i64,
}

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub settings_path: PathBuf,
    pub app_data_dir: PathBuf,
    // 存储 user_data.db 的路径，方便后续连接
    pub user_db_path: PathBuf,
}

// --- Agent 相关结构 ---
#[derive(Serialize, Clone, Debug)]
pub struct AgentUpdateEvent {
    pub step_type: String,
    pub todo_list: Vec<String>,
    pub completed_log: Vec<CompletedTask>,
    pub current_task: Option<String>,
    pub thought: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CompletedTask {
    pub task: String,
    pub thought: String,
}

#[derive(Deserialize)]
struct ExecutorResponse {
    thought: String,
    new_todo_list: Vec<String>,
}

// ==========================================
// 3. 辅助函数
// ==========================================

// 连接 content.db (法条库)
fn connect_sqlite(data_dir: &std::path::Path) -> Result<Connection, String> {
    let db_path_buf = data_dir.join("content.db");
    let mut path_str = db_path_buf.to_string_lossy().to_string();

    #[cfg(windows)]
    {
        if path_str.starts_with(r"\\?\") {
            path_str = path_str[4..].to_string();
        }
    }

    Connection::open(path_str).map_err(|e| format!("SQLite connect error: {}", e))
}

// 连接 user_data.db (用户库)
fn connect_user_db(db_path: &PathBuf) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("无法打开用户数据库: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS favorite_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            law_id TEXT UNIQUE,
            law_name TEXT,
            article_number TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            tags TEXT
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    let column_exists: bool = conn
        .prepare("PRAGMA table_info(favorites)")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            let name: String = row.get(1)?;
            Ok(name == "folder_id")
        })
        .map_err(|e| e.to_string())?
        .any(|res| res.unwrap_or(false));

    if !column_exists {
        println!(">>> Migrating DB: Adding folder_id to favorites");
        conn.execute("ALTER TABLE favorites ADD COLUMN folder_id INTEGER", [])
            .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT UNIQUE,
            timestamp INTEGER
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}

fn load_settings_from_disk(path: &PathBuf) -> AppSettings {
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(settings) = serde_json::from_str(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

fn get_effective_data_dir(state: &AppState) -> PathBuf {
    let settings = state.settings.lock().unwrap();
    if let Some(custom_path) = &settings.custom_data_path {
        if !custom_path.trim().is_empty() {
            let path = PathBuf::from(custom_path);
            if path.exists() {
                return path;
            }
        }
    }
    state.app_data_dir.clone()
}

async fn get_embedding(
    text: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/embeddings", base_url.trim_end_matches('/'));
    let prompt = text.replace("\n", " ");

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model,
            "input": prompt,
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Embedding API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(data) = json.get("data") {
        if let Some(first) = data.get(0) {
            if let Some(vec) = first.get("embedding") {
                let embedding: Vec<f32> = vec
                    .as_array()
                    .ok_or("Invalid embedding format")?
                    .iter()
                    .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                    .collect();
                return Ok(embedding);
            }
        }
    }
    if let Some(vec) = json.get("embedding") {
        let embedding: Vec<f32> = vec
            .as_array()
            .ok_or("Invalid embedding format")?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();
        return Ok(embedding);
    }

    Err("Could not find embedding in response".to_string())
}

async fn call_llm(
    model: &str,
    prompt: &str,
    base_url: &str,
    api_key: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let req_body = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": prompt }],
        "temperature": 0.1,
        "stream": false
    });

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&req_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("LLM API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No content in response")?
        .to_string();

    Ok(content)
}

fn clean_json_str(s: &str) -> String {
    s.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string()
}

// ==========================================
// 4. 核心逻辑
// ==========================================

pub async fn search_law_logic(
    query: String,
    filter_region: Option<String>,
    state: &AppState,
) -> Result<Vec<LawChunk>, String> {
    println!(">>> (Logic) Searching for: {}", query);

    let settings = state.settings.lock().unwrap().clone();
    let data_dir = get_effective_data_dir(state);

    let vector = get_embedding(
        &query,
        &settings.embedding_base_url,
        &settings.embedding_api_key,
        &settings.embedding_model,
    )
    .await?;

    let lancedb_path_buf = data_dir.join("law_db.lancedb");
    let mut path_str = lancedb_path_buf.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        if path_str.starts_with(r"\\?\") {
            path_str = path_str[4..].to_string();
        }
    }

    if !lancedb_path_buf.exists() {
        return Err(format!("数据库路径不存在: {}", path_str));
    }

    let db = lancedb::connect(&path_str)
        .execute()
        .await
        .map_err(|e| format!("Connect error: {}", e))?;
    let table = db
        .open_table("laws_vectors")
        .execute()
        .await
        .map_err(|e| format!("Open table error: {}", e))?;

    let fetch_limit = settings.search_top_k * 3;

    let results_stream = table
        .query()
        .nearest_to(vector)
        .map_err(|e| format!("Vector query error: {}", e))?
        .limit(fetch_limit)
        .execute()
        .await
        .map_err(|e| format!("Search execution error: {}", e))?;

    let mut stream = results_stream;
    let mut chunk_ids: Vec<String> = Vec::new();
    let mut distances: Vec<f32> = Vec::new();

    while let Some(item) = stream.next().await {
        match item {
            Ok(batch) => {
                let id_col = batch.column_by_name("chunk_id").ok_or("Missing chunk_id")?;
                let dist_col = batch
                    .column_by_name("_distance")
                    .ok_or("Missing _distance")?;
                let ids = id_col
                    .as_any()
                    .downcast_ref::<StringArray>()
                    .ok_or("chunk_id error")?;
                let dists = dist_col
                    .as_any()
                    .downcast_ref::<Float32Array>()
                    .ok_or("_distance error")?;
                for i in 0..batch.num_rows() {
                    chunk_ids.push(ids.value(i).to_string());
                    distances.push(dists.value(i));
                }
            }
            Err(e) => return Err(format!("Stream error: {}", e)),
        }
    }

    if chunk_ids.is_empty() {
        return Ok(Vec::new());
    }

    let conn = connect_sqlite(&data_dir)?;
    let placeholders: String = chunk_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT id, content, law_name, category, region, publish_date, part, chapter, article_number 
         FROM chunks WHERE id IN ({})", 
        placeholders
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params = rusqlite::params_from_iter(chunk_ids.iter());

    let chunk_map: std::collections::HashMap<String, LawChunk> = stmt
        .query_map(params, |row| {
            let id: String = row.get(0)?;
            let law_name: String = row.get(2)?;
            Ok((
                id.clone(),
                LawChunk {
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
                },
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    let mut final_results = Vec::new();
    for (i, id) in chunk_ids.iter().enumerate() {
        if let Some(mut chunk) = chunk_map.get(id).cloned() {
            chunk._distance = distances[i];

            let should_keep = if chunk.category != "地方法规" {
                true
            } else {
                if let Some(ref target_region) = filter_region {
                    chunk.region.contains(target_region)
                } else {
                    false
                }
            };

            if should_keep {
                final_results.push(chunk);
            }
        }
    }

    Ok(final_results
        .into_iter()
        .take(settings.search_top_k)
        .collect())
}

// ==========================================
// 5. Tauri 命令
// ==========================================

// 5.1 智能体搜索命令 (Agent)
#[tauri::command]
async fn start_agent_search(
    window: tauri::Window,
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LawChunk>, String> {
    let settings = state.settings.lock().unwrap().clone();
    let (model, base_url, api_key, max_loops) = (
        settings.chat_model,
        settings.chat_base_url,
        settings.chat_api_key,
        settings.max_agent_loops,
    );

    let mut completed_log: Vec<CompletedTask> = vec![];

    // 使用 HashSet 收集 ID 去重，Vec 收集结果
    let mut all_found_chunks: Vec<LawChunk> = vec![];
    let mut seen_ids: HashSet<String> = HashSet::new();

    window
        .emit(
            "agent-update",
            AgentUpdateEvent {
                step_type: "planning".into(),
                todo_list: vec![],
                completed_log: vec![],
                current_task: None,
                thought: Some("正在拆解法律问题...".into()),
            },
        )
        .unwrap();

    let plan_prompt = PLANNER_PROMPT.replace("{user_query}", &query);

    let mut todo_list: Vec<String> = match call_llm(&model, &plan_prompt, &base_url, &api_key).await
    {
        Ok(json) => {
            let clean = clean_json_str(&json);
            serde_json::from_str::<Vec<String>>(&clean).unwrap_or_else(|_| vec![query.clone()])
        }
        Err(_) => vec![query.clone()],
    };

    let mut loop_count = 0;
    let limit = if max_loops <= 0 { 20 } else { max_loops };

    while !todo_list.is_empty() && loop_count < limit {
        loop_count += 1;
        let current_task = todo_list.remove(0);

        window
            .emit(
                "agent-update",
                AgentUpdateEvent {
                    step_type: "executing".into(),
                    todo_list: todo_list.clone(),
                    completed_log: completed_log.clone(),
                    current_task: Some(current_task.clone()),
                    thought: None,
                },
            )
            .unwrap();

        let search_res = search_law_logic(current_task.clone(), None, &state).await;

        let mut result_text = String::new();
        match search_res {
            Ok(chunks) => {
                for r in chunks {
                    // 1.2 阈值过滤
                    if r._distance < 1.2 {
                        // 收集文本给 Agent 看
                        result_text.push_str(&format!(
                            "法规：《{}》{}\n内容：{}\n\n",
                            r.law_name, r.article_number, r.content
                        ));

                        // 收集对象给前端
                        if !seen_ids.contains(&r.id) {
                            seen_ids.insert(r.id.clone());
                            all_found_chunks.push(r);
                        }
                    }
                }
            }
            Err(e) => {
                result_text = format!("搜索出错: {}", e);
            }
        }

        if result_text.trim().is_empty() {
            result_text = "未找到直接相关法条。".to_string();
        }

        window
            .emit(
                "agent-update",
                AgentUpdateEvent {
                    step_type: "thinking".into(),
                    todo_list: todo_list.clone(),
                    completed_log: completed_log.clone(),
                    current_task: Some(current_task.clone()),
                    thought: Some("正在评估检索结果...".into()),
                },
            )
            .unwrap();

        let review_prompt = EXECUTOR_PROMPT
            .replace("{user_query}", &query)
            .replace("{current_task}", &current_task)
            .replace("{search_results}", &result_text)
            .replace(
                "{remaining_todo_list}",
                &serde_json::to_string(&todo_list).unwrap_or("[]".into()),
            );

        match call_llm(&model, &review_prompt, &base_url, &api_key).await {
            Ok(json) => {
                let clean = clean_json_str(&json);
                if let Ok(res) = serde_json::from_str::<ExecutorResponse>(&clean) {
                    todo_list = res.new_todo_list;
                    completed_log.push(CompletedTask {
                        task: current_task,
                        thought: res.thought,
                    });
                } else {
                    completed_log.push(CompletedTask {
                        task: current_task,
                        thought: "解析思考结果失败，继续执行原计划。".into(),
                    });
                }
            }
            Err(_) => {
                completed_log.push(CompletedTask {
                    task: current_task,
                    thought: "LLM 调用失败，跳过此步分析。".into(),
                });
            }
        }
    }

    window
        .emit(
            "agent-update",
            AgentUpdateEvent {
                step_type: "finished".into(),
                todo_list: vec![],
                completed_log: completed_log,
                current_task: None,
                thought: Some("所有任务执行完毕，正在生成最终回答...".into()),
            },
        )
        .unwrap();

    Ok(all_found_chunks)
}

// 5.2 普通搜索命令 (Search)
#[tauri::command]
async fn search_law(
    query: String,
    filter_region: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LawChunk>, String> {
    search_law_logic(query, filter_region, &state).await
}

// 5.3 其他命令 (Others)
#[tauri::command]
fn check_db_status(state: tauri::State<'_, AppState>) -> bool {
    let data_dir = get_effective_data_dir(&state);
    let lancedb_path = data_dir.join("law_db.lancedb");
    lancedb_path.exists()
}

#[tauri::command]
fn search_law_by_name(
    query: String,
    limit: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LawNameSuggestion>, String> {
    let data_dir = get_effective_data_dir(&state);
    let conn = connect_sqlite(&data_dir)?;

    let sql = "SELECT DISTINCT law_name, region, category FROM full_texts WHERE law_name LIKE ? LIMIT 200";
    let query_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let mut suggestions: Vec<LawNameSuggestion> = stmt
        .query_map(rusqlite::params![query_pattern], |row| {
            Ok(LawNameSuggestion {
                name: row.get(0)?,
                region: row.get(1)?,
                category: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    fn get_category_priority(cat: &str) -> i32 {
        match cat {
            "法律" => 1,
            "司法解释" => 2,
            "行政法规" => 3,
            "地方法规" => 4,
            _ => 99,
        }
    }

    suggestions.sort_by(|a, b| {
        let p_a = get_category_priority(&a.category);
        let p_b = get_category_priority(&b.category);

        if p_a != p_b {
            p_a.cmp(&p_b)
        } else {
            a.name.len().cmp(&b.name.len())
        }
    });

    if suggestions.len() > limit {
        suggestions.truncate(limit);
    }

    Ok(suggestions)
}

#[tauri::command]
fn get_article_snippet(
    law_name_query: Option<String>,
    article_number: String,
    current_law_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let data_dir = get_effective_data_dir(&state);
    let conn = connect_sqlite(&data_dir)?;

    let target_law = match law_name_query {
        Some(name) => name,
        None => current_law_name,
    };

    let sql = "SELECT content FROM chunks WHERE law_name LIKE ? AND article_number = ? LIMIT 1";
    let law_pattern = format!("%{}%", target_law);

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(rusqlite::params![law_pattern, article_number])
        .map_err(|e| e.to_string())?;

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
    model: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let res = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("连接失败: 网络请求错误 ({})", e))?;

    if !res.status().is_success() {
        return Err(format!("连接失败: 服务器返回状态码 {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| format!("解析失败: {}", e))?;

    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        let model_exists = data
            .iter()
            .any(|m| m.get("id").and_then(|id| id.as_str()) == Some(&model));

        if model_exists {
            Ok(format!("连接成功！发现模型: {}", model))
        } else {
            Ok(format!(
                "连接通畅，但在列表中未找到模型 '{}' (可能仍可用)",
                model
            ))
        }
    } else {
        Ok("连接成功！(未能验证模型名称)".to_string())
    }
}

#[tauri::command]
fn get_full_text(source_file: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let data_dir = get_effective_data_dir(&state);
    let conn = connect_sqlite(&data_dir)?;

    let law_name = source_file.trim_end_matches(".txt");
    let sql = "SELECT full_text FROM full_texts WHERE law_name = ?";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(rusqlite::params![law_name])
        .map_err(|e| e.to_string())?;

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
    mode: String,
    event_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let settings = state.settings.lock().unwrap().clone();

    // 深度模式下，允许更多的上下文进入（例如 Top 10），普通模式 Top 5
    let limit = if mode == "deep" {
        settings.chat_top_k * 2
    } else {
        settings.chat_top_k
    };

    let selected_chunks = if context_chunks.len() > limit {
        &context_chunks[..limit]
    } else {
        &context_chunks[..]
    };

    let context_str = selected_chunks.join("\n\n");

    // === 分析 Prompts ===

    // 1. 深度思考模式 Prompt：专业法律意见书风格
    let deep_prompt = format!(
        r#"你是一位资深的中国法律顾问。用户提出了一个具体的法律问题，你已经通过检索工具找到了相关的法律条文。
你的任务是根据这些法条，为用户撰写一份专业的《法律检索分析报告》。

要求：
1. 每个结论必须引用具体法条（格式：《XX法》第X条）
2. 如果检索结果不足，明确说明缺少的部分
3. 专业但通俗，避免过度术语堆砌
4. 不编造法条，不做绝对承诺
5. 不需要寒暄

输出结构：

一、核心结论
用一句话回答用户的核心问题。

二、法律依据分析
针对争议点逐条分析：
- 法条依据：《XX法》第X条规定...
- 适用分析：对用户情况的具体解读
- 注意事项：适用条件或例外情况

三、实操建议
1. 证据准备：需要保留哪些材料
2. 维权路径：协商/仲裁/诉讼的具体步骤
3. 时间节点：诉讼时效、关键期限

---
【检索到的法条上下文】：
{}
"#,
        context_str
    );

    // 2. 普通模式 Prompt
    let simple_prompt = format!(
        r#"你是一个法条检索助手。请基于以下检索结果，先简要评估其与用户问题的相关性。然后再给出回答。不需要寒暄。

【检索到的法条】：
{}

要求：
1. 如果法条和问题高度相关，请直接根据法条内容回答用户问题，答案简洁明了，需要引用具体相关法条。不相关法条请予以忽略。
输出示例：
```
关于（用户问题）的问题，（基于xx法xx条，此行为可能构成……）
```
2. 如果法条不相关，请直接告知用户“未找到直接相关依据”，并建议更换搜索词。搜索词应基于法条相似度Embedding的方向设计。
输出示例：
```
查找到的法条相关度较低，根据您的问题，建议以下搜索词重新搜索：（数个搜索词）
```
3. 如果法条相关度完全不足，请告知用户检查向量模型和数据库是否匹配。
"#,
        context_str
    );

    // 根据 mode 选择 prompt
    let system_prompt = if mode == "deep" {
        deep_prompt
    } else {
        simple_prompt
    };

    let user_prompt = format!("用户问题：{}\n\n请开始分析：", query);

    let client = reqwest::Client::new();
    let url = format!(
        "{}/chat/completions",
        settings.chat_base_url.trim_end_matches('/')
    );

    let mut stream = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", settings.chat_api_key))
        .json(&serde_json::json!({
            "model": settings.chat_model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": true,
            "temperature": if mode == "deep" { 0.4 } else { 0.3 }
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
                        if json_str == "[DONE]" {
                            break;
                        }
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                            if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                let _ = app.emit(&event_id, content);
                            } else if let Some(content) = json["message"]["content"].as_str() {
                                let _ = app.emit(&event_id, content);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let _ = app.emit("chat-token", format!("[Error: {}]", e));
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(
    new_settings: AppSettings,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.settings.lock().unwrap();
    *guard = new_settings.clone();

    let json = serde_json::to_string_pretty(&new_settings).map_err(|e| e.to_string())?;
    let _ = fs::write(&state.settings_path, json);

    Ok(())
}

// === User Data CRUD Commands ===

#[tauri::command]
fn add_favorite(
    chunk: LawChunk,
    folder_id: Option<i32>, // 修改：接收 folder_id
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    // 使用 REPLACE INTO 或者 ON CONFLICT 更新 folder_id
    conn.execute(
        "INSERT INTO favorites (law_id, law_name, article_number, content, folder_id) 
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(law_id) DO UPDATE SET folder_id = excluded.folder_id",
        rusqlite::params![
            chunk.id,
            chunk.law_name,
            chunk.article_number,
            chunk.content,
            folder_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn move_favorite(
    law_id: String,
    folder_id: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    conn.execute(
        "UPDATE favorites SET folder_id = ?2 WHERE law_id = ?1",
        rusqlite::params![law_id, folder_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn remove_favorite(law_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    conn.execute(
        "DELETE FROM favorites WHERE law_id = ?1",
        rusqlite::params![law_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_folder(name: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    conn.execute(
        "INSERT INTO favorite_folders (name) VALUES (?1)",
        rusqlite::params![name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_folders(state: tauri::State<'_, AppState>) -> Result<Vec<UserFolder>, String> {
    let conn = connect_user_db(&state.user_db_path)?;
    let mut stmt = conn
        .prepare("SELECT id, name, created_at FROM favorite_folders ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let folders = stmt
        .query_map([], |row| {
            Ok(UserFolder {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(folders)
}

#[tauri::command]
fn delete_folder(folder_id: i32, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    conn.execute(
        "DELETE FROM favorites WHERE folder_id = ?1",
        rusqlite::params![folder_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM favorite_folders WHERE id = ?1",
        rusqlite::params![folder_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_favorites(state: tauri::State<'_, AppState>) -> Result<Vec<UserFavorite>, String> {
    let conn = connect_user_db(&state.user_db_path)?;
    let mut stmt = conn.prepare("SELECT id, law_id, law_name, article_number, content, created_at, tags, folder_id FROM favorites ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let favorites = stmt
        .query_map([], |row| {
            Ok(UserFavorite {
                id: row.get(0)?,
                law_id: row.get(1)?,
                law_name: row.get(2)?,
                article_number: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
                tags: row.get(6)?,
                folder_id: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(favorites)
}

#[tauri::command]
fn check_is_favorite(law_id: String, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let conn = connect_user_db(&state.user_db_path)?;
    let count: i32 = conn
        .query_row(
            "SELECT count(*) FROM favorites WHERE law_id = ?1",
            rusqlite::params![law_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(count > 0)
}

#[tauri::command]
fn add_history(query: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "REPLACE INTO search_history (query, timestamp) VALUES (?1, ?2)",
        rusqlite::params![query, timestamp],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM search_history WHERE id NOT IN (SELECT id FROM search_history ORDER BY timestamp DESC LIMIT 50)",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_history(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let conn = connect_user_db(&state.user_db_path)?;
    let mut stmt = conn
        .prepare("SELECT query FROM search_history ORDER BY timestamp DESC")
        .map_err(|e| e.to_string())?;

    let history = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(history)
}

#[tauri::command]
fn clear_history(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = connect_user_db(&state.user_db_path)?;
    conn.execute("DELETE FROM search_history", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ==========================================
// 6. 程序入口
// ==========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 1. 获取 exe 目录 (便携模式检测)
            let mut exe_path = std::env::current_exe()?;
            exe_path.pop();
            let portable_settings = exe_path.join("settings.json");
            let portable_user_db = exe_path.join("user_data.db");

            // 2. 获取系统 AppData 目录
            let app_config_dir = app.path().resolve("", BaseDirectory::AppConfig)?;
            if !app_config_dir.exists() {
                std::fs::create_dir_all(&app_config_dir)?;
            }
            let system_settings = app_config_dir.join("settings.json");
            let system_user_db = app_config_dir.join("user_data.db");

            // 3. 决策路径
            // 规则：如果 exe 旁边有配置文件，就认为是便携模式，数据库也读旁边的
            // 否则全部走系统目录
            let (final_settings_path, final_user_db_path) = if portable_settings.exists() {
                println!(">>> Mode: Portable");
                (portable_settings, portable_user_db)
            } else {
                println!(">>> Mode: Standard (AppData)");
                (system_settings, system_user_db)
            };

            // 4. 加载配置
            let settings = if final_settings_path.exists() {
                load_settings_from_disk(&final_settings_path)
            } else {
                println!(">>> Creating default settings at {:?}", final_settings_path);
                let default = AppSettings::default();
                // 首次运行自动生成配置文件
                let json = serde_json::to_string_pretty(&default)?;
                let _ = fs::write(&final_settings_path, json);
                default
            };

            // 5. 初始化用户数据库
            // 如果文件不存在，connect_user_db 内部会自动创建
            let _ = connect_user_db(&final_user_db_path).map_err(|e| {
                eprintln!("User DB init failed: {}", e);
                e
            });

            // 6. 默认资源路径 (content.db)
            // 同样支持便携优先: exe/data > resource/app_data
            let portable_data_dir = exe_path.join("data");
            let resource_data_dir = app
                .path()
                .resolve("resources/app_data", BaseDirectory::Resource)?;

            let final_app_data_dir = if portable_data_dir.exists() {
                portable_data_dir
            } else {
                resource_data_dir
            };

            app.manage(AppState {
                settings: Mutex::new(settings),
                settings_path: final_settings_path,
                app_data_dir: final_app_data_dir,
                user_db_path: final_user_db_path,
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
            check_db_status,
            start_agent_search,
            // User Data Commands
            add_favorite,
            remove_favorite,
            get_favorites,
            check_is_favorite,
            add_history,
            get_history,
            clear_history,
            create_folder,
            get_folders,
            delete_folder,
            move_favorite,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
