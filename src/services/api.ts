// src/services/api.ts

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface LawChunk {
  id: string;
  content: string;
  law_name: string;
  category: string;
  publish_date: string;
  part: string;
  chapter: string;
  article_number: string;
  source_file: string;
  _distance: number;
  region: string;
}

export interface SearchResponse {
  results: LawChunk[];
}

export interface FullTextResponse {
  source_file: string;
  content: string;
}

export interface LawNameSuggestion {
  name: string;
  region: string;
  category: string;
}

export interface LawNameSearchResponse {
  results: LawNameSuggestion[];
}

// User Data: 收藏夹
export interface UserFavorite {
  id: number;
  law_id: string;
  law_name: string;
  article_number: string;
  content: string;
  created_at: string;
  tags?: string;
  folder_id?: number | null;
}

export interface UserFolder {
  id: number;
  name: string;
  created_at: string;
}

// Agent: 更新事件
export interface AgentUpdateEvent {
  step_type: "planning" | "executing" | "thinking" | "finished" | "error";
  todo_list: string[];
  completed_log: {
    task: string;
    thought: string;
  }[];
  current_task?: string;
  thought?: string;
}

export interface AppSettings {
  search_top_k: number;
  display_density: "comfortable" | "compact";
  custom_data_path?: string;

  embedding_base_url: string;
  embedding_api_key: string;
  embedding_model: string;

  enable_ai_chat: boolean;
  chat_base_url: string;
  chat_api_key: string;
  chat_model: string;
  chat_top_k: number;

  max_agent_loops: number;
}

export interface DraftMaterial {
  id: number;
  law_id: string;
  law_name: string;
  article_number: string;
  content: string;
  added_at: string;
}

export interface CustomTemplate {
  id: number;
  name: string;
  content: string;
}

// --- 核心搜索 ---

export async function searchLaw(
  query: string,
  filterRegion?: string
): Promise<{ results: LawChunk[] }> {
  try {
    const results = await invoke<LawChunk[]>("search_law", {
      query,
      filterRegion: filterRegion || null,
    });
    return { results };
  } catch (error) {
    console.error("Search failed:", error);
    throw error;
  }
}

export async function searchLawByName(
  query: string,
  limit: number = 10
): Promise<LawNameSearchResponse> {
  try {
    const results = await invoke<LawNameSuggestion[]>("search_law_by_name", {
      query,
      limit,
    });
    return { results };
  } catch (error) {
    console.error("Search by name failed:", error);
    return { results: [] };
  }
}

// --- AI 与 Agent ---

export async function startAgentSearch(query: string, eventId: string): Promise<LawChunk[]> {
  try {
    return await invoke<LawChunk[]>("start_agent_search", { query, eventId });
  } catch (error) {
    console.error("Agent search failed:", error);
    throw error;
  }
}

export async function stopTask(eventId: string): Promise<void> {
  return await invoke("stop_task", { eventId });
}

export async function startChatStream(
  query: string,
  contextChunks: string[],
  mode: "simple" | "deep" | "draft",
  onToken: (token: string) => void,
  externalEventId?: string
) {
  const eventId = externalEventId || `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const unlisten = await listen<string>(eventId, (event) => {
    onToken(event.payload);
  });

  invoke("chat_stream", { query, contextChunks, mode, eventId }).catch(
    (err) => {
      onToken(`[Error: ${err}]`);
    }
  );

  return unlisten;
}

export async function checkAiConnection(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    const message = await invoke<string>("check_ai_connection", {
      baseUrl,
      apiKey,
      model,
    });
    return message;
  } catch (error) {
    throw new Error(String(error));
  }
}

// --- User Data (收藏与历史) ---

export async function getFavorites(): Promise<UserFavorite[]> {
  return await invoke("get_favorites");
}

export async function createFolder(name: string): Promise<void> {
  return await invoke("create_folder", { name });
}

export async function getFolders(): Promise<UserFolder[]> {
  return await invoke("get_folders");
}

export async function deleteFolder(folderId: number): Promise<void> {
  return await invoke("delete_folder", { folderId });
}

export async function addFavorite(
  chunk: LawChunk,
  folderId?: number | null
): Promise<void> {
  return await invoke("add_favorite", { chunk, folderId: folderId || null });
}

export async function moveFavorite(
  lawId: string,
  folderId: number | null
): Promise<void> {
  return await invoke("move_favorite", { lawId, folderId });
}

export async function removeFavorite(lawId: string): Promise<void> {
  return await invoke("remove_favorite", { lawId });
}

export async function checkIsFavorite(lawId: string): Promise<boolean> {
  return await invoke("check_is_favorite", { lawId });
}

export async function addHistory(query: string): Promise<void> {
  return await invoke("add_history", { query });
}

export async function getHistory(): Promise<string[]> {
  return await invoke("get_history");
}

export async function clearHistory(): Promise<void> {
  return await invoke("clear_history");
}

// --- 系统与配置 ---

export async function getFullText(
  source_file: string
): Promise<FullTextResponse> {
  try {
    const content = await invoke<string>("get_full_text", {
      sourceFile: source_file,
    });
    return { source_file, content };
  } catch (error) {
    console.error("Get full text failed:", error);
    throw error;
  }
}

export async function getSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: any) {
  return await invoke("save_settings", { newSettings: settings });
}

export async function getArticleSnippet(
  lawName: string | null,
  articleNumber: string,
  currentLaw: string
): Promise<string> {
  try {
    return await invoke<string>("get_article_snippet", {
      lawNameQuery: lawName,
      articleNumber: articleNumber,
      currentLawName: currentLaw,
    });
  } catch (e) {
    return "加载预览失败";
  }
}

export async function checkDbStatus(): Promise<boolean> {
  try {
    return await invoke<boolean>("check_db_status");
  } catch (e) {
    console.error("Failed to check db status", e);
    return false;
  }
}

// 文件夹选择器 (仅用于设置中更改数据路径)
import { open } from "@tauri-apps/plugin-dialog";
export async function selectFolder(): Promise<string | null> {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择数据库所在的文件夹",
    });
    return selected as string | null;
  } catch (e) {
    console.error("Select folder failed", e);
    return null;
  }
}

export async function stopChat(eventId: string): Promise<void> {
  return await invoke("stop_chat", { eventId });
}

// 素材库 API
export async function addDraftMaterial(chunk: LawChunk): Promise<void> {
  return await invoke("add_draft_material", { chunk });
}

export async function getDraftMaterials(): Promise<DraftMaterial[]> {
  return await invoke("get_draft_materials");
}

export async function removeDraftMaterial(lawId: string): Promise<void> {
  return await invoke("remove_draft_material", { lawId });
}

export async function clearDraftMaterials(): Promise<void> {
  return await invoke("clear_draft_materials");
}

// 模版 API
export async function addTemplate(name: string, content: string): Promise<void> {
  return await invoke("add_template", { name, content });
}

export async function getTemplates(): Promise<CustomTemplate[]> {
  return await invoke("get_templates");
}

export async function deleteTemplate(id: number): Promise<void> {
  return await invoke("delete_template", { id });
}
