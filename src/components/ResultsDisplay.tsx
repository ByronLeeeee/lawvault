// frontend/src/components/ResultsDisplay.tsx

import React from "react";
import { LawChunk } from "../services/api";
import { ResultCard } from "./ResultCard";
import { motion } from "framer-motion";
import { ServerCrash, FileSearch, Sparkles } from "lucide-react"; // 增加 Sparkles 图标
import { SkeletonCard } from "./SkeletonCard";
import { AIChatBox } from "./AIChatBox";

interface ResultsDisplayProps {
  results: LawChunk[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  query?: string;
  onViewFullText: (law: LawChunk) => void;
  density: "comfortable" | "compact";
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  isLoading,
  error,
  hasSearched,
  query,
  onViewFullText,
  density = "comfortable",
}) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card bg-base-100 shadow-lg max-w-md mx-auto mt-16 border border-error/20"
        >
          <div className="card-body items-center text-center">
            <ServerCrash className="w-16 h-16 mb-2 text-error/80" />
            <h2 className="card-title text-error">连接中断</h2>
            <p className="text-base-content/70 mb-6">
              我们无法连接到搜索服务，请检查后端是否运行。
            </p>
            <div className="card-actions">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-error text-white px-8"
              >
                刷新页面
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    if (hasSearched && results.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero mt-10 bg-base-100 rounded-2xl p-10 shadow-sm border border-base-200 text-center"
        >
          <div className="hero-content flex-col">
            <div className="bg-base-200 p-4 rounded-full mb-2">
              <FileSearch className="w-10 h-10 text-base-content/40" />
            </div>
            <h1 className="text-xl font-bold text-base-content/80">
              没有找到相关结果
            </h1>
            <p className="py-2 text-neutral max-w-xs mx-auto">
              尝试精简关键词，或者使用更通用的法律术语。
            </p>
          </div>
        </motion.div>
      );
    }

    if (!hasSearched) {
      return (
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
          <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-all cursor-default">
            <div className="card-body p-5 flex-row items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full text-primary">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base-content">自然语言提问</h3>
                <p className="text-xs text-base-content/60">
                  "劳动合同试用期最长多久？"
                </p>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-all cursor-default">
            <div className="card-body p-5 flex-row items-center gap-4">
              <div className="bg-secondary/10 p-3 rounded-full text-secondary">
                <FileSearch size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base-content">精确查找</h3>
                <p className="text-xs text-base-content/60">
                  直接搜索 "劳动法"{" "}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        className="space-y-4"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.08,
            },
          },
        }}
        initial="hidden"
        animate="show"
        key={results.length}
      >
        {results.length > 0 && query && (
          <AIChatBox query={query} results={results} />
        )}
        {results.map((result) => (
          <ResultCard
            key={`${result.source_file}-${result.article_number}`}
            law={result}
            query={query || ""}
            onViewFullText={onViewFullText}
            density={density}
          />
        ))}
      </motion.div>
    );
  };

  return <div className="max-w-4xl mx-auto pb-10">{renderContent()}</div>;
};
