// frontend/src/App.tsx

import { useState, useEffect, useRef, useMemo } from "react";
import { SearchBar } from "./components/SearchBar";
import { ResultsDisplay } from "./components/ResultsDisplay";
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
import { getVersion } from "@tauri-apps/api/app";
import { UpdateModal, GithubUpdate } from "./components/UpdateModal";
import { startAgentSearch, AgentUpdateEvent, stopTask } from "./services/api";
import { AgentView } from "./components/AgentView";
import { listen } from "@tauri-apps/api/event";
import { Sparkles } from "lucide-react";
import { useHistory } from "./hooks/useHistory";
import { TabBar } from "./components/TabBar";
import { LawDetailView } from "./components/LawDetailView";
import { Tab } from "./types";
import { DraftingView } from "./components/DraftingView";
import { useDrafting } from "./hooks/useDrafting";

function App() {
  // === Tab State ===
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "home", type: "search", title: "搜索首页", isActive: true },
  ]);
  const [activeTabId, setActiveTabId] = useState("home");

  // === Search State  ===
  const [query, setQuery] = useState("");
  const [executedQuery, setExecutedQuery] = useState("");
  const [rawResults, setRawResults] = useState<LawChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // === Other UI State ===
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [availableUpdate, setAvailableUpdate] = useState<GithubUpdate | null>(
    null
  );
  const [isMissingDb, setIsMissingDb] = useState(false);
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
  const currentAgentIdRef = useRef<string | null>(null);
  const { addMaterial } = useDrafting();
  const {
    history: searchHistory,
    add: addToHistory,
    clear: clearHistory,
  } = useHistory();

  // === Effects ===

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

  // === Tab Actions ===

  const switchToTab = (id: string) => {
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    const newTabs = tabs.filter((t) => t.id !== id);
    if (newTabs.length === 0) {
      setTabs([
        { id: "home", type: "search", title: "搜索首页", isActive: true },
      ]);
      setActiveTabId("home");
    } else {
      setTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
    }
  };

  const openNewSearchTab = () => {
    setActiveTabId("home");
  };

  const openLawTab = (law: LawChunk) => {
    const existing = tabs.find((t) => t.data?.law?.id === law.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const newTab: Tab = {
      id: law.id || `law-${Date.now()}`,
      type: "law-detail",
      title: law.law_name,
      isActive: true,
      data: { law },
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const openDraftingTab = () => {
    const existing = tabs.find((t) => t.type === "drafting");
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const newTab: Tab = {
        id: "drafting-desk",
        type: "drafting",
        title: "写作助手",
        isActive: true,
      };
      setTabs([...tabs, newTab]);
      setActiveTabId("drafting-desk");
    }
  };

  // === Handlers ===

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
        toast.error("请先选择正确的数据库路径！", { duration: 4000 });
      }
    } else {
      setIsSettingsOpen(false);
    }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    if (activeTabId !== "home") setActiveTabId("home");

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
        setIsAgentRunning(true);
        const agentResults = await startAgentSearch(searchQuery, newAgentId);
        setRawResults(agentResults);
      } else {
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
    openLawTab(lawToView);
  };

  // === Memos ===

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

  // === Render ===

  return (
    <div className="bg-base-100 h-screen w-screen flex flex-col font-sans overflow-hidden">
      <TitleBar />
      <Toaster position="top-center" reverseOrder={false} />

      {/* 1. Tab Bar */}
      <div className="mt-8 shrink-0">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={switchToTab}
          onClose={closeTab}
          onNewSearch={openNewSearchTab}
          onReorder={setTabs}
          onOpenDrafting={openDraftingTab}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenFavorites={() => setIsFavoritesOpen(true)}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 h-96 bg-linear-to-b from-base-200 to-base-100 -z-10" />

      {/* 2. Main Viewport */}
      <div className="flex-1 relative overflow-hidden bg-base-100">
        {/* === View A: Search Home === */}
        <div
          className="h-full w-full overflow-hidden flex flex-col"
          style={{ display: activeTabId === "home" ? "flex" : "none" }}
        >       

          <main className="grow w-full overflow-y-auto scroll-smooth">
            <div className="container max-w-4xl mx-auto px-4 pb-20">
              <div
                className={`transition-all duration-500 ease-in-out ${
                  hasSearched ? "mt-4 mb-8" : "mt-20 mb-12 text-center"
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
                  className="sticky top-0 z-20 mb-6 -mx-4 px-4 pt-2 pb-2 bg-base-100/90 backdrop-blur"
                >
                  <div className="navbar bg-base-100 border border-base-200 rounded-box px-4 py-2 gap-4 flex-wrap md:flex-nowrap shadow-sm">
                    {/* ... Filter Controls ... */}
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
                              animate={{
                                opacity: 1,
                                width: 140,
                                paddingLeft: 8,
                              }}
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
                <div className="max-w-4xl mx-auto mb-6">
                  <AgentView
                    event={agentEvent}
                    isProcessing={isAgentRunning}
                    onStop={() => {
                      if (currentAgentIdRef.current)
                        stopTask(currentAgentIdRef.current);
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
                onViewFullText={openLawTab}
                density={density}
                isDeepThink={isDeepThink}
                onAddMaterial={(law) => addMaterial(law)}
              />
            </div>
          </main>
        </div>

        {/* === View B: Law Detail Tabs === */}
        {tabs.map((tab) => {
          if (tab.type === "law-detail") {
            return (
              <div
                key={tab.id}
                className="absolute inset-0 bg-base-100"
                style={{
                  display: activeTabId === tab.id ? "block" : "none",
                  zIndex: 10,
                }}
              >
                {tab.data?.law && (
                  <LawDetailView
                    law={tab.data.law}
                    onOpenLink={openLawTab}
                    onAddMaterial={(law) => addMaterial(law)}
                  />
                )}
              </div>
            );
          }
          // View C: Drafting View
          if (tab.type === "drafting") {
            return (
              <div
                key={tab.id}
                className="absolute inset-0 bg-base-100"
                style={{
                  display: activeTabId === tab.id ? "block" : "none",
                  zIndex: 10,
                }}
              >
                <DraftingView />
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isFavoritesOpen && (
          <FavoritesSidebar
            isOpen={isFavoritesOpen}
            onClose={() => setIsFavoritesOpen(false)}
            onViewFullText={(law) => {
              openLawTab(law);
              setIsFavoritesOpen(false);
            }}
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

      {/* 仅在搜索首页显示 StatusBar */}
      {activeTabId === "home" && (
        <StatusBar
          isLoading={isLoading}
          resultsCount={displayedResults.length}
          searchTime={searchTime}
        />
      )}
    </div>
  );
}

export default App;
