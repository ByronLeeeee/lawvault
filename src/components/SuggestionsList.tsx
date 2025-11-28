// frontend/src/components/SuggestionsList.tsx
import React from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { LawNameSuggestion } from "../services/api";

interface SuggestionsListProps {
  suggestions: LawNameSuggestion[];
  onSuggestionClick: (suggestion: LawNameSuggestion) => void;
}

const categoryPriority: { [key: string]: number } = {
  法律: 1,
  司法解释: 2,
  行政法规: 3,
  地方法规: 4,
};

export const SuggestionsList: React.FC<SuggestionsListProps> = ({
  suggestions,
  onSuggestionClick,
}) => {
  if (suggestions.length === 0) {
    return null;
  }

  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const priorityA = categoryPriority[a.category] || 99;
    const priorityB = categoryPriority[b.category] || 99;
    return priorityA - priorityB;
  });

  return (
    <motion.div
      className="absolute z-50 w-full mt-2 card bg-base-100 shadow-xl border border-base-200 overflow-hidden"
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
    >
      <ul className="menu menu-sm dropdown-content p-2 w-full gap-1">
        <li className="menu-title px-2 py-1 text-xs font-semibold text-base-content/50 uppercase tracking-wider">
          按标题快速跳转
        </li>

        {sortedSuggestions.map((suggestion) => (
          <li key={`${suggestion.name}-${suggestion.region}`}>
            <a
              onMouseDown={() => onSuggestionClick(suggestion)}
              className="flex justify-between items-center gap-4 py-2 active:bg-primary active:text-primary-content"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-base-content/50 shrink-0" />
                <span className="truncate font-medium">{suggestion.name}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`badge badge-sm border-0 ${
                    suggestion.category === "法律"
                      ? "badge-primary"
                      : suggestion.category === "行政法规"
                      ? "badge-secondary"
                      : "badge-ghost"
                  }`}
                >
                  {suggestion.category}
                </span>

                {suggestion.region && (
                  <span className="badge badge-xs badge-outline text-base-content/50">
                    {suggestion.region}
                  </span>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};
