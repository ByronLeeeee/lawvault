// src/components/TabBar.tsx

import React, { useState, useRef, useEffect } from "react";
import { Tab } from "../types";
import { 
  X, Search, FileText, Plus, PenTool, Settings, Star, 
  ChevronDown} from "lucide-react";
import { Reorder, AnimatePresence, motion } from "framer-motion";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewSearch: () => void;
  onReorder: (newTabs: Tab[]) => void;
  onOpenDrafting: () => void;
  onOpenSettings: () => void;
  onOpenFavorites: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewSearch,
  onReorder,
  onOpenDrafting,
  onOpenSettings,
  onOpenFavorites,
}) => {
  const [showTabList, setShowTabList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        setShowTabList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fixedTabs = tabs.filter(t => t.id === "home");
  const sortableTabs = tabs.filter(t => t.id !== "home");

  const handleReorder = (newOrder: Tab[]) => {
    onReorder([...fixedTabs, ...newOrder]);
  };

  // 渲染单个标签内容的辅助函数
  const renderTabContent = (tab: Tab, isActive: boolean) => (
    <>
      {tab.type === "search" ? (
        <Search size={14} className={isActive ? "stroke-2" : ""} />
      ) : tab.type === "drafting" ? (
        <PenTool size={14} className={isActive ? "stroke-2" : ""} />
      ) : (
        <FileText size={14} className={isActive ? "stroke-2" : ""} />
      )}
      <span className="truncate flex-1">{tab.title}</span>
      {(tabs.length > 1 || tab.type !== "search") && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
          className={`p-0.5 rounded-md hover:bg-base-300/80 transition-opacity ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <X size={12} />
        </button>
      )}
    </>
  );

  const tabBaseClasses = "relative group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] text-xs font-medium cursor-pointer rounded-t-lg transition-colors border-t border-x select-none h-full shrink-0";
  const getActiveClasses = (isActive: boolean) => isActive ? "bg-base-100 border-base-300 border-b-base-100 text-primary z-10" : "bg-transparent border-transparent text-base-content/60 hover:bg-base-200 hover:text-base-content";

  return (
    <div className="flex items-end px-2 pt-2 bg-base-200/50 border-b border-base-300 gap-1 h-10 shrink-0 relative z-20">
      
      {/* === 1. 滚动标签区域 (自适应宽度) === */}
      <div className="flex-1 flex items-end overflow-x-auto no-scrollbar gap-1 h-full mask-linear-fade-right">
        {/* 固定标签 */}
        {fixedTabs.map((tab) => (
            <div key={tab.id} onClick={() => onSwitch(tab.id)} className={`${tabBaseClasses} ${getActiveClasses(activeTabId === tab.id)}`} title={tab.title}>
              {renderTabContent(tab, activeTabId === tab.id)}
            </div>
        ))}
        {/* 可拖拽标签 */}
        <Reorder.Group axis="x" values={sortableTabs} onReorder={handleReorder} className="flex items-end gap-1 h-full">
          {sortableTabs.map((tab) => (
              <Reorder.Item key={tab.id} value={tab} onClick={() => onSwitch(tab.id)} initial={false} className={`${tabBaseClasses} ${getActiveClasses(activeTabId === tab.id)}`} title={tab.title} whileDrag={{ backgroundColor: "var(--fallback-b2,oklch(var(--b2)/1))", opacity: 0.9, cursor: "grabbing", zIndex: 50 }}>
                {renderTabContent(tab, activeTabId === tab.id)}
              </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* === 2. 右侧固定工具栏 === */}
      <div className="flex items-center gap-1 pb-1 pl-2 bg-base-200/50 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] z-20">
        
        {/* 标签列表下拉 (当标签很多时非常有用) */}
        <div className="relative" ref={listRef}>
            <button 
                onClick={() => setShowTabList(!showTabList)} 
                className={`btn btn-ghost btn-xs btn-square ${showTabList ? "bg-base-300" : ""}`}
                title="所有已打开的标签"
            >
                <ChevronDown size={14} />
            </button>

            <AnimatePresence>
                {showTabList && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-8 right-0 w-64 bg-base-100 shadow-xl border border-base-200 rounded-lg p-2 z-50 max-h-96 overflow-y-auto"
                    >
                        <div className="text-xs font-bold text-base-content/40 px-2 py-1 mb-1">已打开 {tabs.length} 个标签</div>
                        {tabs.map(tab => (
                            <div 
                                key={tab.id}
                                onClick={() => { onSwitch(tab.id); setShowTabList(false); }}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs ${activeTabId === tab.id ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-base-200'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    {tab.type === 'search' ? <Search size={12}/> : tab.type === 'drafting' ? <PenTool size={12}/> : <FileText size={12}/>}
                                    <span className="truncate">{tab.title}</span>
                                </div>
                                {tab.id !== 'home' && (
                                    <button onClick={(e) => { e.stopPropagation(); onClose(tab.id); }} className="hover:text-error p-1"><X size={12}/></button>
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        <div className="h-4 w-px bg-base-300 mx-1"></div>

        {/* 常用功能组 */}
        <div className="tooltip tooltip-bottom" data-tip="新搜索">
            <button onClick={onNewSearch} className="btn btn-ghost btn-xs btn-square text-base-content/70">
                <Plus size={16} />
            </button>
        </div>

        <div className="tooltip tooltip-bottom" data-tip="写作助手">
            <button onClick={onOpenDrafting} className="btn btn-ghost btn-xs btn-square text-base-content/70">
                <PenTool size={14} />
            </button>
        </div>
        
        <div className="tooltip tooltip-bottom" data-tip="我的收藏">
            <button onClick={onOpenFavorites} className="btn btn-ghost btn-xs btn-square text-base-content/70">
                <Star size={14} />
            </button>
        </div>

        <div className="tooltip tooltip-bottom" data-tip="设置">
            <button onClick={onOpenSettings} className="btn btn-ghost btn-xs btn-square text-base-content/70">
                <Settings size={14} />
            </button>
        </div>

      </div>
    </div>
  );
};