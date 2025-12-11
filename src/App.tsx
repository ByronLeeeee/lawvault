// frontend/src/App.tsx

import { useState, useEffect, useRef, useMemo } from "react";
import { SearchBar } from "./components/SearchBar";
import { ResultsDisplay } from "./components/ResultsDisplay";
import { FullTextModal } from "./components/FullTextModal";
import { FavoritesSidebar } from "./components/FavoritesSidebar";
import { SearchHistory } from "./components/SearchHistory";
import { StatusBar } from "./components/StatusBar";
import { ExportButton } from "./components/ExportButton";
import toast, { Toaster } from "react-hot-toast";
import { TitleBar } from "./components/TitleBar";
import { SettingsModal } from "./components/SettingsModal";
import {
  searchLaw,
  LawChunk,
  LawNameSuggestion,
  getSettings,
  checkDbStatus,
} from "./services/api";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, Star } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { UpdateModal, GithubUpdate } from "./components/UpdateModal";
import { startAgentSearch, AgentUpdateEvent, stopTask } from "./services/api";
import { AgentView } from "./components/AgentView";
import { listen } from "@tauri-apps/api/event";
import { Sparkles } from "lucide-react";
import { useHistory } from "./hooks/useHistory";

function App() {
  const [query, setQuery] = useState("");
  const [executedQuery, setExecutedQuery] = useState("");
  const [rawResults, setRawResults] = useState<LawChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [availableUpdate, setAvailableUpdate] = useState<GithubUpdate | null>(
    null
  );
  const [isMissingDb, setIsMissingDb] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<LawChunk | null>(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

  const [sortBy, setSortBy] = useState<"relevance" | "date">("relevance");
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [searchLocal, setSearchLocal] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");

  const [searchTime] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [agentEvent, setAgentEvent] = useState<AgentUpdateEvent | null>(null);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const {
    history: searchHistory,
    add: addToHistory,
    clear: clearHistory,
  } = useHistory();

  useEffect(() => {
    const unlisten = listen<AgentUpdateEvent>("agent-update", (e) => {
      setAgentEvent(e.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        const settings = await getSettings();
        if (settings.display_density) {
          setDensity(settings.display_density);
        }
      } catch (e) {
        console.error(e);
      }

      const dbReady = await checkDbStatus();

      if (!dbReady) {
        setIsMissingDb(true);
        setIsSettingsOpen(true);
        toast(
          (_t) => (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">👋 欢迎使用 LawVault</span>
              <span className="text-xs">检测到数据库未配置。</span>
              <span className="text-xs">
                请在设置中选择您解压的 <b>数据文件夹</b> (包含 content.db)。
              </span>
            </div>
          ),
          {
            duration: 8000,
            icon: "📂",
            style: { border: "1px solid #fbbf24" },
          }
        );
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    getSettings()
      .then((data) => {
        if (data.display_density) {
          setDensity(data.display_density);
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));
  }, [isSettingsOpen]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const currentVersion = await getVersion();

        const response = await fetch(
          "https://api.github.com/repos/byronleeeee/lawvault/releases/latest"
        );

        if (response.ok) {
          const data = await response.json();
          const latestTag = data.tag_name;

          const cleanLatest = latestTag.replace(/^v/, "");

          if (cleanLatest !== currentVersion) {
            setAvailableUpdate({
              version: latestTag,
              body: data.body || "",
              html_url: data.html_url,
            });
          }
        }
      } catch (error) {
        console.error("Update check failed:", error);
      }
    };

    const timer = setTimeout(checkForUpdates, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleSettingsClose = async () => {
    if (isMissingDb) {
      const ready = await checkDbStatus();

      if (ready) {
        setIsMissingDb(false);
        setIsSettingsOpen(false);
        toast.success("数据库配置成功，正在重载...", { duration: 3000 });
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(
          "请先选择正确的数据库路径！\n(需包含 content.db 和 law_db.lancedb)",
          {
            duration: 4000,
          }
        );
      }
    } else {
      setIsSettingsOpen(false);
    }
  };
  const currentAgentIdRef = useRef<string | null>(null);
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    if (currentAgentIdRef.current) {
      await stopTask(currentAgentIdRef.current);
      currentAgentIdRef.current = null;
    }
    setExecutedQuery(searchQuery);
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setAgentEvent(null);
    setRawResults([]);
    addToHistory(searchQuery);

    const newAgentId = `agent-${Date.now()}`;
    currentAgentIdRef.current = newAgentId;

    try {
      if (isDeepThink) {
        // === Agent 模式 ===
        setIsAgentRunning(true);
        const agentResults = await startAgentSearch(searchQuery, newAgentId);
        setRawResults(agentResults);
      } else {
        // === 普通模式 ===
        const regionParam = searchLocal ? regionQuery : undefined;
        const response = await searchLaw(searchQuery, regionParam);
        setRawResults(response.results);
      }
    } catch (err) {
      const errorMsg = String(err);
      
      if (errorMsg.includes("手动停止")) {
         console.log("用户停止深度思考，自动降级为普通搜索...");
         toast("已停止深度思考，显示普通搜索结果", { icon: "🛑" });
         setIsDeepThink(false);       
         try {
             const regionParam = searchLocal ? regionQuery : undefined;
             const response = await searchLaw(searchQuery, regionParam);
             setRawResults(response.results);
         } catch (fallbackErr) {
             setError("普通搜索也失败了: " + String(fallbackErr));
         }
      } else {
         setError("搜索失败，请检查服务日志。");
         console.error(err);
      }
    } finally {
      setIsLoading(false);
      setIsAgentRunning(false);
      currentAgentIdRef.current = null;
    }
  };

  const handleSuggestionClick = (suggestion: LawNameSuggestion) => {
    const lawToView: LawChunk = {
      id: `${suggestion.name}-full-text`,
      law_name: suggestion.name,
      source_file: `${suggestion.name}.txt`,
      article_number: "全文",
      category: suggestion.category,
      region: suggestion.region,
      content: "正在加载全文...",
      publish_date: "",
      part: "",
      chapter: "",
      _distance: 0,
    };

    setSelectedLaw(lawToView);
  };

  const visibleCategories = useMemo(() => {
    const categoriesInResults = new Set(rawResults.map((r) => r.category));
    const baseCategories = ["法律", "司法解释", "行政法规"];
    if (categoriesInResults.has("地方法规")) {
      return [...baseCategories, "地方法规"];
    }
    return baseCategories;
  }, [rawResults]);

  const displayedResults = useMemo(() => {
    let processedResults = [...rawResults];

    if (filterCategories.length > 0) {
      processedResults = processedResults.filter((result) =>
        filterCategories.includes(result.category)
      );
    }

    if (sortBy === "date") {
      processedResults.sort((a, b) =>
        (b.publish_date || "").localeCompare(a.publish_date || "")
      );
    }

    return processedResults;
  }, [rawResults, filterCategories, sortBy]);

  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey && event.key === "k") ||
        (event.key === "/" &&
          !["INPUT", "TEXTAREA"].includes(
            (event.target as HTMLElement).tagName
          ))
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="bg-base-100 min-h-screen font-sans relative flex flex-col overflow-hidden">
      <TitleBar />
      <Toaster position="top-center" reverseOrder={false} />

      <div className="absolute top-0 left-0 right-0 h-96 bg-linear-to-b from-base-200 to-base-100 -z-10" />

      <nav className="w-full max-w-6xl mx-auto px-4 py-6 mt-8 flex justify-between items-center">
        <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-default">
          <span className="text-sm font-bold tracking-wider uppercase text-base-content">
            智能法条库
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary"
            title="系统设置"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">设置</span>
          </button>

          <button
            onClick={() => setIsFavoritesOpen(true)}
            className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary"
          >
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">我的收藏</span>
          </button>
        </div>
      </nav>

      <main className="grow container max-w-4xl mx-auto px-4 pb-20">
        <div
          className={`transition-all duration-500 ease-in-out ${
            hasSearched ? "mt-8 mb-8" : "mt-20 mb-12 text-center"
          }`}
        >
          <h1
            className={`font-extrabold text-base-content mb-2 transition-all duration-500 ${
              hasSearched ? "text-2xl" : "text-4xl lg:text-6xl"
            }`}
          >
            法律法规<span className="text-primary">·</span>智能搜
          </h1>
          {!hasSearched && (
            <p className="text-lg text-base-content/60 mb-8 max-w-lg mx-auto">
              基于语义理解的本地知识库，精准定位您需要的法律条文。
            </p>
          )}

          <div className="relative z-20">
            <SearchBar
              ref={searchInputRef}
              onSearch={handleSearch}
              onSuggestionClick={handleSuggestionClick}
              isLoading={isLoading}
              query={query}
              setQuery={setQuery}
            />
            <div className="flex justify-center mt-3">
              <label className="label cursor-pointer justify-start gap-2 bg-base-100/50 px-3 py-1 rounded-full border border-base-200 shadow-sm backdrop-blur-md">
                <span
                  className={`label-text flex items-center gap-1 text-xs font-bold transition-colors ${
                    isDeepThink ? "text-primary" : "text-base-content/60"
                  }`}
                >
                  <Sparkles
                    size={14}
                    className={isDeepThink ? "fill-primary" : ""}
                  />
                  深度思考模式 (Agent)
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-xs toggle-primary"
                  checked={isDeepThink}
                  onChange={(e) => setIsDeepThink(e.target.checked)}
                />
              </label>
            </div>
          </div>

          {!hasSearched && searchHistory.length > 0 && (
            <div className="mt-8 max-w-2xl mx-auto">
              <SearchHistory
                history={searchHistory}
                onHistoryClick={(q) => {
                  setQuery(q);
                  handleSearch(q);
                }}
                onClearHistory={clearHistory}
              />
            </div>
          )}
        </div>

        {hasSearched && !isLoading && rawResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-4 z-10 mb-6"
          >
            <div className="navbar bg-base-100/80 backdrop-blur-md shadow-sm border border-base-200 rounded-box px-4 py-2 gap-4 flex-wrap md:flex-nowrap">
              <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wide mr-2 shrink-0">
                  筛选
                </span>
                {visibleCategories.map((cat) => (
                  <label key={cat} className="cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="peer hidden"
                      checked={filterCategories.includes(cat)}
                      onChange={() =>
                        setFilterCategories((prev) =>
                          prev.includes(cat)
                            ? prev.filter((c) => c !== cat)
                            : [...prev, cat]
                        )
                      }
                    />
                    <span className="badge badge-lg badge-outline bg-transparent border-base-300 text-base-content/70 peer-checked:badge-primary peer-checked:border-primary peer-checked:text-primary-content transition-all hover:bg-base-200">
                      {cat}
                    </span>
                  </label>
                ))}
              </div>

              <div className="hidden md:block w-px h-6 bg-base-300 mx-2"></div>

              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end">
                <div className="join items-center">
                  <label className="btn btn-sm btn-ghost join-item px-2 gap-2 font-normal">
                    <input
                      type="checkbox"
                      checked={searchLocal}
                      onChange={(e) => setSearchLocal(e.target.checked)}
                      className="toggle toggle-xs toggle-primary"
                    />
                    <span className="text-sm">地方法规</span>
                  </label>
                  <AnimatePresence>
                    {searchLocal && (
                      <motion.div
                        initial={{ opacity: 0, width: 0, paddingLeft: 0 }}
                        animate={{ opacity: 1, width: 140, paddingLeft: 8 }}
                        exit={{ opacity: 0, width: 0, paddingLeft: 0 }}
                        className="overflow-hidden join-item bg-base-100"
                      >
                        <input
                          type="text"
                          value={regionQuery}
                          onChange={(e) => setRegionQuery(e.target.value)}
                          placeholder="输入地区..."
                          className="input input-sm input-bordered w-full focus:outline-none text-xs"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "relevance" | "date")
                  }
                  className="select select-sm select-ghost w-auto font-normal text-base-content/70"
                >
                  <option value="relevance">按相关度</option>
                  <option value="date">按日期</option>
                </select>

                <ExportButton results={displayedResults} />
              </div>
            </div>
          </motion.div>
        )}

        {hasSearched && isDeepThink && (
          <div className="max-w-4xl mx-auto mt-8 px-4">
            <AgentView
              event={agentEvent}
              isProcessing={isAgentRunning}
              onStop={() => {
                if (currentAgentIdRef.current) {
                  stopTask(currentAgentIdRef.current);
                }
              }}
            />
          </div>
        )}

        <ResultsDisplay
          results={displayedResults}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          query={executedQuery}
          onViewFullText={setSelectedLaw}
          density={density}
          isDeepThink={isDeepThink}
        />
      </main>

      <AnimatePresence>
        {isFavoritesOpen && (
          <FavoritesSidebar
            isOpen={isFavoritesOpen}
            onClose={() => setIsFavoritesOpen(false)}
            onViewFullText={(law) => {
              setSelectedLaw(law);
              setIsFavoritesOpen(false);
            }}
          />
        )}
        {selectedLaw && (
          <FullTextModal
            law={selectedLaw}
            onClose={() => setSelectedLaw(null)}
          />
        )}
      </AnimatePresence>
      <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
      {availableUpdate && (
        <UpdateModal
          update={availableUpdate}
          onClose={() => setAvailableUpdate(null)}
        />
      )}
      <StatusBar
        isLoading={isLoading}
        resultsCount={displayedResults.length}
        searchTime={searchTime}
      />
    </div>
  );
}

export default App;
