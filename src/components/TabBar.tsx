// src/components/TabBar.tsx
import React from "react";
import { Tab } from "../types";
import { X, Search, FileText, Plus, PenTool } from "lucide-react";
import { Reorder } from "framer-motion"; 

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewSearch: () => void;
  onReorder: (newTabs: Tab[]) => void;
  onOpenDrafting: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewSearch,
  onReorder,
  onOpenDrafting,
}) => {
  const fixedTabs = tabs.filter(t => t.id === "home");
  const sortableTabs = tabs.filter(t => t.id !== "home");

  const handleReorder = (newOrder: Tab[]) => {
    onReorder([...fixedTabs, ...newOrder]);
  };

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
      {tab.id !== "home" && (
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

  const tabBaseClasses = `
    relative group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] 
    text-xs font-medium cursor-pointer rounded-t-lg transition-colors
    border-t border-x select-none h-full
  `;

  const getActiveClasses = (isActive: boolean) =>
    isActive
      ? "bg-base-100 border-base-300 border-b-base-100 text-primary z-10"
      : "bg-transparent border-transparent text-base-content/60 hover:bg-base-200 hover:text-base-content";

  return (
    <div className="flex items-end px-2 pt-2 bg-base-200/50 border-b border-base-300 gap-1 overflow-x-auto no-scrollbar h-10 shrink-0">
      
      {fixedTabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            className={`${tabBaseClasses} ${getActiveClasses(isActive)}`}
            title={tab.title}
          >
            {renderTabContent(tab, isActive)}
          </div>
        );
      })}

      <Reorder.Group
        axis="x"
        values={sortableTabs}
        onReorder={handleReorder}
        className="flex items-end gap-1 h-full"
      >
        {sortableTabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <Reorder.Item
              key={tab.id}
              value={tab}
              onClick={() => onSwitch(tab.id)}
              initial={false}
              className={`${tabBaseClasses} ${getActiveClasses(isActive)}`}
              title={tab.title}
              whileDrag={{
                backgroundColor: "var(--fallback-b2,oklch(var(--b2)/1))",
                opacity: 0.9,
                cursor: "grabbing",
                zIndex: 50,
              }}
            >
              {renderTabContent(tab, isActive)}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <button
        onClick={onNewSearch}
        className="btn btn-ghost btn-xs btn-square mb-1 ml-1 hover:bg-base-300 text-base-content/50"
        title="新搜索"
      >
        <Plus size={16} />
      </button>

      <button
            onClick={onOpenDrafting}
            className="btn btn-ghost btn-xs btn-square hover:bg-base-300 text-base-content/50"
            title="写作助手"
        >
            <PenTool size={14} />
        </button>
    </div>
  );
};