import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export interface LawChunk {
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

export interface FavoriteItem extends LawChunk {
  id: string;
}

export interface FavoriteFolder {
  id: string;
  name: string;
  items: FavoriteItem[];
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
}

export async function searchLaw(
  query: string,
  filterRegion?: string // 新增可选参数
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

export async function startChatStream(
  query: string,
  contextChunks: string[],
  onToken: (token: string) => void
) {
  const unlisten = await listen<string>("chat-token", (event) => {
    onToken(event.payload);
  });

  invoke("chat_stream", { query, contextChunks }).catch((err) => {
    onToken(`[Error: ${err}]`);
  });

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

export async function selectFolder(): Promise<string | null> {
  try {
    const selected = await open({
      directory: true, // 只选文件夹
      multiple: false,
      title: "选择数据库所在的文件夹 (包含 content.db 和 law_db 文件夹)",
    });
    return selected as string | null;
  } catch (e) {
    console.error("Select folder failed", e);
    return null;
  }
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
