// frontend/src/components/ResultCard.tsx

import React from "react";
import { LawChunk } from "../services/api";
import { motion, Variants } from "framer-motion";
import {
  Calendar,
  Folder,
  ChevronsRight,
  Star,
  MapPin,
  Copy,
} from "lucide-react";
import { highlightText } from "../utils/highlight";
import { toast } from "react-hot-toast";
import { useFavorites } from "../hooks/useFavorites"; // 引入新的 Hook

interface ResultCardProps {
  law: LawChunk;
  query: string;
  onViewFullText: (law: LawChunk) => void;
  density: "comfortable" | "compact";
}

const cardVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export const ResultCard: React.FC<ResultCardProps> = ({
  law,
  query,
  onViewFullText,
  density,
}) => {
  // 使用自定义 Hook 获取收藏状态和操作方法
  const { isFavorite, add, remove } = useFavorites();
  
  // 检查当前条目是否已收藏 (依赖 law.id)
  const favored = isFavorite(law.id);

  // 切换收藏状态
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发卡片点击
    if (favored) {
      await remove(law.id);
    } else {
      await add(law);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return "N/A";
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  };

  // 计算相关度显示分数
  const relevanceScore = Math.max(
    0,
    Math.min(100, Math.round((1 - law._distance / 2) * 100))
  );

  const copyCitation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `《${law.law_name}》${law.article_number}：\n${law.content}`;
    navigator.clipboard.writeText(text);
    toast.success("已复制引用格式");
  };

  // === 紧凑模式 (Compact Mode) ===
  if (density === "compact") {
    return (
      <motion.div
        layout
        className="card card-bordered bg-base-100 shadow-xs hover:bg-base-200/50 transition-colors cursor-pointer group rounded-lg mb-2"
        onClick={() => onViewFullText(law)}
        variants={cardVariants}
      >
        <div className="px-4 py-3 flex items-center gap-4">
          <div className="flex flex-col items-center justify-center shrink-0 w-10">
            <div
              className={`radial-progress text-[10px] font-bold ${
                relevanceScore > 80 ? "text-success" : "text-primary/70"
              }`}
              style={
                {
                  "--value": relevanceScore,
                  "--size": "2rem",
                  "--thickness": "2px",
                } as React.CSSProperties
              }
            >
              {relevanceScore}
            </div>
          </div>

          <div className="grow min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-base-content truncate">
                《{law.law_name}》
              </span>
              <span className="badge badge-xs badge-ghost font-mono shrink-0">
                {law.article_number}
              </span>
            </div>
            <span className="text-xs text-base-content/60 truncate opacity-80 block">
              {highlightText(law.content, query)}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* 收藏按钮 (紧凑模式) */}
            <button
              className={`btn btn-square btn-xs btn-ghost transition-colors ${
                favored ? "text-yellow-500 hover:text-yellow-600" : "text-base-content/30 hover:text-yellow-500 opacity-0 group-hover:opacity-100"
              }`}
              onClick={handleToggleFavorite}
              title={favored ? "取消收藏" : "加入收藏"}
            >
              <Star size={14} className={favored ? "fill-yellow-500" : ""} />
            </button>

            <button
              className="btn btn-square btn-xs btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={copyCitation}
              title="复制引用"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // === 舒适模式 (Comfortable Mode) ===
  return (
    <motion.div
      className="card card-bordered bg-base-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out group"
      variants={cardVariants}
    >
      <div className="card-body p-5 sm:p-6">
        <div className="flex justify-between items-start gap-4 mb-2">
          <div className="space-y-1">
            <h3
              className="font-bold text-lg text-base-content leading-tight group-hover:text-primary transition-colors cursor-pointer"
              onClick={() => onViewFullText(law)}
            >
              {law.law_name}
            </h3>
            <div className="text-sm font-medium text-base-content/70 bg-base-200/50 inline-block px-2 py-0.5 rounded">
              {law.article_number}
            </div>
          </div>

          <div
            className="flex flex-col items-center gap-1 shrink-0"
            title={`相似距离: ${law._distance.toFixed(4)}`}
          >
            <div
              className="radial-progress text-xs font-bold text-primary bg-base-200/30 border-4 border-transparent"
              style={
                {
                  "--value": relevanceScore,
                  "--size": "2.8rem",
                  "--thickness": "3px",
                } as React.CSSProperties
              }
            >
              {relevanceScore}%
            </div>
          </div>
        </div>

        <div
          className="text-base-content/80 text-sm leading-7 line-clamp-4 mb-4 text-justify cursor-pointer hover:text-base-content/90 transition-colors"
          onClick={() => onViewFullText(law)}
        >
          <p>{highlightText(law.content, query)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-base-100">
          <div className="badge badge-ghost badge-sm gap-1.5 text-base-content/60">
            <Folder size={12} /> <span>{law.category}</span>
          </div>
          {law.region && (
            <div className="badge badge-ghost badge-sm gap-1.5 text-base-content/60">
              <MapPin size={12} /> <span>{law.region}</span>
            </div>
          )}
          <div className="badge badge-ghost badge-sm gap-1.5 text-base-content/60">
            <Calendar size={12} /> <span>{formatDate(law.publish_date)}</span>
          </div>
        </div>

        <div className="card-actions justify-end items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* 收藏按钮 (舒适模式) */}
          <button
            onClick={handleToggleFavorite}
            className={`btn btn-xs btn-ghost gap-1 transition-all ${
              favored 
                ? "text-yellow-600 bg-yellow-50 hover:bg-yellow-100" 
                : "text-base-content/60 hover:text-yellow-600"
            }`}
          >
            <Star size={14} className={favored ? "fill-yellow-500 text-yellow-500" : ""} />
            {favored ? "已收藏" : "收藏"}
          </button>

          <button onClick={copyCitation} className="btn btn-xs btn-ghost gap-1">
            <Copy size={14} /> 引用
          </button>
          
          <button
            onClick={() => onViewFullText(law)}
            className="btn btn-xs btn-primary ml-2"
          >
            查看全文 <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};