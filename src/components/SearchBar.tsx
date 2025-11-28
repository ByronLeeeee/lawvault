// frontend/src/components/SearchBar.tsx
import React, { useState, useEffect, forwardRef } from "react";
import { searchLawByName, LawNameSuggestion } from "../services/api";
import { useDebounce } from "../hooks/useDebounce";
import { SuggestionsList } from "./SuggestionsList";
import { AnimatePresence } from "framer-motion";
import { X, Search as SearchIcon } from "lucide-react"; // 增加 Search 图标导入

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSuggestionClick: (suggestion: LawNameSuggestion) => void;
  isLoading: boolean;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ onSearch, onSuggestionClick, isLoading, query, setQuery }, ref) => {
    const [suggestions, setSuggestions] = useState<LawNameSuggestion[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const debouncedQuery = useDebounce(query, 300);

    const handleClear = () => {
      setQuery("");
      if (ref && "current" in ref && ref.current) {
        ref.current.focus();
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setSuggestions([]);
      onSearch(query);
    };

    const handleSuggestionClick = (suggestion: LawNameSuggestion) => {
      setQuery(suggestion.name);
      setSuggestions([]);
      onSuggestionClick(suggestion);
    };

    useEffect(() => {
      if (debouncedQuery.length > 1 && isFocused) {
        const fetchSuggestions = async () => {
          try {
            const response = await searchLawByName(debouncedQuery);
            setSuggestions(response.results);
          } catch (error) {
            console.error("Failed to fetch suggestions", error);
            setSuggestions([]);
          }
        };
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
    }, [debouncedQuery, isFocused]);

    return (
      <div className="relative max-w-2xl mx-auto z-30">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-base-content/70 transition-colors duration-300 pointer-events-none">
            <SearchIcon size={20} />
          </div>

          <input
            ref={ref}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="输入问题进行语义搜索，或输入标题模糊查找..."
            className="input input-lg h-14 w-full pl-12 pr-24 bg-base-100 border-base-200 focus:border-base-content/20 focus:outline-none shadow-sm focus:shadow-[0_0_25px_-5px_rgba(0,0,0,0.1)] transition-all duration-300 text-base md:text-lg rounded-xl"
            disabled={isLoading}
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && !isLoading ? (
              <button
                type="button"
                onClick={handleClear}
                className="btn btn-sm btn-circle btn-ghost text-base-content/50 hover:text-base-content hover:bg-base-200"
                aria-label="Clear search input"
              >
                <X size={18} />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 pointer-events-none opacity-50 select-none">
                <kbd className="kbd kbd-sm bg-base-200 border-none font-sans min-h-0 h-7">
                  Ctrl
                </kbd>
                <span className="text-xs">+</span>
                <kbd className="kbd kbd-sm bg-base-200 border-none font-sans min-h-0 h-7">
                  K
                </kbd>
              </div>
            )}
          </div>
        </form>

        <AnimatePresence>
          {isFocused && suggestions.length > 0 && (
            <SuggestionsList
              suggestions={suggestions}
              onSuggestionClick={handleSuggestionClick}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);
