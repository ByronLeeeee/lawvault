// frontend/src/components/SearchHistory.tsx
import React from "react";
import { History } from "lucide-react";

interface SearchHistoryProps {
  history: string[];
  onHistoryClick: (query: string) => void;
  onClearHistory: () => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onHistoryClick,
  onClearHistory,
}) => {
  if (history.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div className="flex justify-between items-center mb-3 px-1">
        <h4 className="text-sm font-semibold text-base-content/70 flex items-center gap-2">
          <History size={16} /> 搜索历史
        </h4>
        <button
          onClick={onClearHistory}
          className="btn btn-link btn-xs text-error no-underline hover:underline p-0"
        >
          清空历史
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {history.map((item, index) => (
          <button
            key={index}
            onClick={() => onHistoryClick(item)}
            className="btn btn-xs btn-outline bg-base-100 hover:bg-base-200 border-base-300 text-base-content font-normal h-auto py-1 px-3"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};
