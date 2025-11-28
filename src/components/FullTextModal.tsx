// frontend/src/components/FullTextModal.tsx

import React, { useState, useEffect, useRef } from "react";
import { getArticleSnippet, getFullText, LawChunk } from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { LoaderCircle, X, ServerCrash, Copy, Check } from "lucide-react";
import { CustomPopover } from "./CustomPopover";

interface FullTextModalProps {
  law: LawChunk;
  onClose: () => void;
}

interface TOCItem {
  id: string;
  text: string;
  level: 1 | 1.5 | 2 | 3; // 1=编, 1.5=分编, 2=章, 3=节
}

// --- 样式常量 (Typography) ---
// 大标题 (编)
const partClasses =
  "text-3xl font-black text-center mt-16 mb-8 text-base-content tracking-widest";
// 分编样式
const subPartClasses =
  "text-2xl font-extrabold text-center mt-14 mb-7 text-base-content/95 tracking-wider scroll-mt-20";
// 中标题 (章)
const chapterClasses =
  "text-2xl font-bold text-center mt-12 mb-6 text-base-content/90 tracking-wide";
// 小标题 (节)
const sectionClasses =
  "text-xl font-bold text-left mt-8 mb-4 pl-4 border-l-4 border-primary text-base-content/80";
// 条文 (Article)
const articleContainerClasses =
  "mb-2 py-2 px-2 rounded-lg transition-colors duration-500"; // 容器
const articleLabelClasses = "font-bold mr-2 text-base-content select-none"; // "第X条" 的样式
const paragraphClasses =
  "mb-2 text-lg leading-8 text-justify text-base-content/80 indent-8"; // 正文段落，增加行高和缩进
// 前言/说明
// 文档大标题 (例如：中华人民共和国民法典)
const docTitleClasses =
  "text-3xl lg:text-4xl font-black text-center mt-8 mb-6 text-base-content select-none";

// 文档元数据 (例如：发布日期会议)
const docMetaClasses =
  "text-lg text-center text-base-content/60 mb-12 font-serif";

// 目录/通用居中标题
const centerTitleClasses =
  "text-2xl font-bold text-center mt-8 mb-8 text-base-content";

const preambleClasses =
  "text-lg leading-8 text-base-content/70 mb-4 px-4 lg:px-10 font-serif indent-8 text-justify";

export const FullTextModal: React.FC<FullTextModalProps> = ({
  law,
  onClose,
}) => {
  const [fullText, setFullText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedArticleId, setCopiedArticleId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [popoverState, setPopoverState] = useState({
    visible: false,
    content: "",
    top: 0,
    left: 0,
  });
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchFullText = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getFullText(law.source_file);
        setFullText(response.content);
      } catch (err) {
        setError("加载全文失败，请稍后再试。");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFullText();
  }, [law.source_file]);

  useEffect(() => {
    if (fullText) {
      const lines = fullText.split("\n");
      const allHeaders: {
        id: string;
        text: string;
        level: number;
        lineIndex: number;
      }[] = [];
      let firstArticleLineIndex = -1;

      // 1. 扫描全文，提取所有标题和第一条的位置
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 记录正文开始位置（找到第一个“第X条”）
        if (
          firstArticleLineIndex === -1 &&
          /^\s*第[一二三四五六七八九十百]+条/.test(trimmed)
        ) {
          firstArticleLineIndex = index;
        }

        // 提取标题
        if (/^\s*第[一二三四五六七八九十百]+编/.test(trimmed)) {
          allHeaders.push({
            id: `part-${index}`,
            text: trimmed,
            level: 1,
            lineIndex: index,
          });
        } else if (/^\s*第[一二三四五六七八九十百]+分编/.test(trimmed)) {
          allHeaders.push({
            id: `subpart-${index}`,
            text: trimmed,
            level: 1.5,
            lineIndex: index,
          });
        } else if (/^\s*第[一二三四五六七八九十百]+章/.test(trimmed)) {
          allHeaders.push({
            id: `chapter-${index}`,
            text: trimmed,
            level: 2,
            lineIndex: index,
          });
        } else if (/^\s*第[一二三四五六七八九十百]+节/.test(trimmed)) {
          allHeaders.push({
            id: `section-${index}`,
            text: trimmed,
            level: 3,
            lineIndex: index,
          });
        }
      });

      // 如果没有找到条文（非标准文档），直接返回所有标题
      if (firstArticleLineIndex === -1) {
        setToc(allHeaders as any);
        return;
      }

      // 2. 分区处理
      // A. 后区：在第一条之后的所有标题 -> 全部保留 (正文内容)
      const postBodyHeaders = allHeaders.filter(
        (h) => h.lineIndex >= firstArticleLineIndex
      );

      // B. 前区：在第一条之前的标题 -> 倒序回溯查找“生效”的父级标题
      const preBodyHeaders = allHeaders.filter(
        (h) => h.lineIndex < firstArticleLineIndex
      );
      const keptPreHeaders: typeof allHeaders = [];

      // 倒序遍历前区标题
      let currentLevelLimit = 100;

      for (let i = preBodyHeaders.length - 1; i >= 0; i--) {
        const header = preBodyHeaders[i];
        if (header.level < currentLevelLimit) {
          keptPreHeaders.unshift(header);
          currentLevelLimit = header.level;
        }
        if (currentLevelLimit === 1) break;
      }

      // 3. 合并结果
      const finalToc = [...keptPreHeaders, ...postBodyHeaders];
      setToc(finalToc as any);
    }
  }, [fullText]);

  const handleCopy = (articleId: string, content: string) => {
    // 从ID中提取纯条号，例如 "article-第一条" -> "第一条"
    const artNum = articleId.replace("article-", "");

    // 拼接引用格式： 《民法典》第一条：\n内容
    const textToCopy = `《${law.law_name}》${artNum}：\n${content}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedArticleId(articleId);
    setTimeout(() => setCopiedArticleId(null), 1500);
  };

  // --- 辅助函数：处理引用链接 ---\
  const fetchPopoverContent = async (
    lawNameRef: string | undefined,
    artNum: string
  ) => {
    setPopoverState((prev) => ({
      ...prev,
      visible: true,
      content: "正在查找条文...",
    }));

    // 如果正则没捕获到法名，或者法名包含"本法"，则视为当前法律
    let targetLaw = null;
    if (lawNameRef && !lawNameRef.includes("本法")) {
      targetLaw = lawNameRef;
    }

    const content = await getArticleSnippet(targetLaw, artNum, law.law_name);
    setPopoverState((prev) => ({ ...prev, content: content }));
  };

  // --- 辅助函数：清洗法条名称 ---
  const cleanLawName = (raw: string | undefined): string | null => {
    if (!raw) return null;

    if (raw.startsWith("《") && raw.endsWith("》")) {
      return raw.replace(/[《》]/g, "");
    }

    if (raw === "本法") return null;

    // 扩充清洗词库，解决 "属于..." 问题
    const stopWords = [
      "根据",
      "违反",
      "适用",
      "照",
      "执行",
      "于",
      "履行", // 动词
      "的",
      "在",
      "与",
      "和",
      "及",
      "向",
      "对",
      "是", // 介词/连词
    ];

    let cleaned = raw;
    for (const word of stopWords) {
      if (cleaned.includes(word)) {
        const parts = cleaned.split(word);
        cleaned = parts[parts.length - 1];
      }
    }

    if (cleaned.length < 2 || cleaned.length > 20) return null;
    return cleaned;
  };

  const renderParagraphWithReferences = (
    paragraphText: string,
    paraKey: string
  ) => {
    const referencePattern =
      /((?:《[^《》]+》)|(?:本法)|(?:(?!依照|根据|违反|适用|参照|按照|执行|属于)[\u4e00-\u9fa5]{2,25}法))?(第[一二三四五六七八九十百]+条(?:之一|之二)?)/g;

    const matches = [...paragraphText.matchAll(referencePattern)];
    if (matches.length === 0) return paragraphText;

    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    let lastContextLawName: string | null = null;

    matches.forEach((match, i) => {
      let [fullMatch, rawLawGroup, articleNumber] = match;

      // 1. 尝试获取当前显式提到的法律名称
      let currentLawName = cleanLawName(rawLawGroup);

      // 2. 计算前缀
      let prefix = "";
      let highlightText = fullMatch;

      if (
        rawLawGroup &&
        currentLawName &&
        rawLawGroup !== currentLawName &&
        !rawLawGroup.startsWith("《")
      ) {
        const cleanIndex = rawLawGroup.lastIndexOf(currentLawName);
        if (cleanIndex > 0) {
          prefix = rawLawGroup.substring(0, cleanIndex);
          highlightText = currentLawName + articleNumber;
        }
      }

      // 3. 上下文继承逻辑
      const startIndex = match.index!;

      let effectiveLawName = currentLawName;

      if (i > 0) {
        const prevMatch = matches[i - 1];
        const prevEnd = prevMatch.index! + prevMatch[0].length;
        // 计算两个匹配项之间的“空隙文本”
        const gap = paragraphText.substring(prevEnd, startIndex).trim();

        // 如果当前没有明确法律名，且中间的间隔只是顿号、逗号、或“和/及”
        if (!currentLawName && /^[、，,和及\s]+$/.test(gap)) {
          effectiveLawName = lastContextLawName;
        }
      }

      if (currentLawName) {
        lastContextLawName = currentLawName;
      } else if (effectiveLawName) {
        // 保持继承的状态
      } else {
        lastContextLawName = null;
      }

      // 4. 填补普通文本
      if (startIndex > lastIndex) {
        result.push(paragraphText.substring(lastIndex, startIndex));
      }
      if (prefix) {
        result.push(prefix);
      }

      const key = `${paraKey}-match-${i}`;

      result.push(
        <a
          key={key}
          href={`#`}
          className="link link-primary no-underline hover:underline bg-primary/5 px-1 rounded mx-0.5 font-medium transition-colors cursor-help"
          onMouseEnter={(e) => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

            const rect = e.currentTarget.getBoundingClientRect();
            const container = contentRef.current;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();

            const popoverWidth = 384;
            const popoverHeight = 300;
            const padding = 10;

            // 坐标计算
            let left =
              rect.left -
              containerRect.left +
              rect.width / 2 -
              popoverWidth / 2;
            if (left < padding) left = padding;
            else if (left + popoverWidth > containerRect.width - padding) {
              left = containerRect.width - popoverWidth - padding;
            }
            left += container.scrollLeft;

            let top =
              rect.bottom - containerRect.top + container.scrollTop + 10;
            const viewportHeight = window.innerHeight;

            // 翻转检测
            if (rect.bottom + popoverHeight > viewportHeight - 20) {
              top =
                rect.top -
                containerRect.top +
                container.scrollTop -
                popoverHeight -
                10;
            }

            setPopoverState({
              visible: true,
              content: "加载中...",
              top: top,
              left: left,
            });

            fetchPopoverContent(effectiveLawName || undefined, articleNumber);
          }}
          onMouseLeave={() => {
            hideTimeoutRef.current = window.setTimeout(() => {
              setPopoverState((prev) => ({ ...prev, visible: false }));
            }, 200);
          }}
          onClick={(e) => {
            e.preventDefault();
            const isCurrentLaw =
              !effectiveLawName ||
              effectiveLawName === "本法" ||
              law.law_name.includes(effectiveLawName);

            if (isCurrentLaw) {
              const targetId = `article-${articleNumber}`;
              document
                .getElementById(targetId)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              const el = document.getElementById(targetId);
              if (el) triggerHighlight(el);
            }
          }}
        >
          {highlightText}
        </a>
      );
      lastIndex = startIndex + fullMatch.length;
    });

    if (lastIndex < paragraphText.length)
      result.push(paragraphText.substring(lastIndex));
    return <>{result}</>;
  };
  // --- 排版渲染逻辑 ---
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    const resultNodes: React.ReactNode[] = [];

    // 正则表达式
    const partPattern = /^\s*(第[一二三四五六七八九十百]+编\s+.*)/;
    const subPartPattern = /^\s*(第[一二三四五六七八九十百]+分编\s+.*)/;
    const chapterPattern = /^\s*(第[一二三四五六七八九十百]+章\s+.*)/;
    const sectionPattern = /^\s*(第[一二三四五六七八九十百]+节\s+.*)/;
    const articlePattern = /^\s*(第[一二三四五六七八九十百千万零]+条)(.*)/;

    let currentArticleId = "";
    let currentArticleContent: string[] = [];
    let isPreamble = true;

    const flushArticle = () => {
      if (currentArticleId) {
        const fullContent = currentArticleContent.join("\n");

        resultNodes.push(
          <div
            key={currentArticleId}
            id={currentArticleId}
            className={`${articleContainerClasses} group relative`}
          >
            <button
              onClick={() => handleCopy(currentArticleId, fullContent)}
              className="absolute right-2 top-2 p-1.5 text-base-content/30 hover:text-primary hover:bg-base-200 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              title="复制本条"
            >
              {copiedArticleId === currentArticleId ? (
                <Check size={16} className="text-success" />
              ) : (
                <Copy size={16} />
              )}
            </button>

            {currentArticleContent.map((line, idx) => {
              if (idx === 0) {
                const match = line.match(articlePattern);
                if (match) {
                  return (
                    <p key={idx} className={paragraphClasses}>
                      <span className={articleLabelClasses}>{match[1]}</span>
                      {renderParagraphWithReferences(
                        match[2],
                        `${currentArticleId}-${idx}`
                      )}
                    </p>
                  );
                }
              }
              return (
                <p key={idx} className={paragraphClasses}>
                  {renderParagraphWithReferences(
                    line,
                    `${currentArticleId}-${idx}`
                  )}
                </p>
              );
            })}
          </div>
        );
        currentArticleContent = [];
        currentArticleId = "";
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // 1. 检查是否是 编/章/节 标题
      if (partPattern.test(trimmedLine)) {
        flushArticle();
        isPreamble = false;
        resultNodes.push(
          <h2
            key={`part-${index}`}
            id={`part-${index}`}
            className={partClasses}
          >
            {trimmedLine}
          </h2>
        );
        return;
      }
      if (subPartPattern.test(trimmedLine)) {
        flushArticle();
        isPreamble = false;
        resultNodes.push(
          <h2
            key={`subpart-${index}`}
            id={`subpart-${index}`}
            className={subPartClasses}
          >
            {trimmedLine}
          </h2>
        );
        return;
      }
      if (chapterPattern.test(trimmedLine)) {
        flushArticle();
        isPreamble = false;
        resultNodes.push(
          <h3
            key={`chapter-${index}`}
            id={`chapter-${index}`}
            className={chapterClasses}
          >
            {trimmedLine}
          </h3>
        );
        return;
      }
      if (sectionPattern.test(trimmedLine)) {
        flushArticle();
        isPreamble = false;
        resultNodes.push(
          <h4
            key={`section-${index}`}
            id={`section-${index}`}
            className={sectionClasses}
          >
            {trimmedLine}
          </h4>
        );
        return;
      }

      // 2. 检查是否是 "第X条" 开头
      const articleMatch = trimmedLine.match(articlePattern);
      if (articleMatch) {
        flushArticle();
        isPreamble = false;
        currentArticleId = `article-${articleMatch[1]}`;
        currentArticleContent.push(trimmedLine);
        return;
      }

      // 3. 普通段落处理
      if (currentArticleId) {
        // 如果当前正在处理一条条文，这行是该条文的后续段落
        currentArticleContent.push(trimmedLine);
      } else if (isPreamble) {
        // 1. 检测 "目 录" (中间可能有空格)
        if (/^目\s*录$/.test(trimmedLine)) {
          resultNodes.push(
            <h2 key={`toc-title-${index}`} className={centerTitleClasses}>
              {trimmedLine}
            </h2>
          );
        }
        // 2. 检测圆括号包裹的日期/会议信息 (例如：(2020年5月28日...通过))
        // 兼容中文括号（）和英文括号()
        else if (
          /^[（(].*[）)]$/.test(trimmedLine) ||
          trimmedLine.endsWith("通过")
        ) {
          resultNodes.push(
            <div key={`meta-${index}`} className={docMetaClasses}>
              {trimmedLine}
            </div>
          );
        }
        // 3. 检测文档大标题
        // 逻辑：如果是前几行，且跟文件名相似，或者没有标点符号且比较短
        else if (
          trimmedLine === law.law_name ||
          (trimmedLine.length < 30 && !/[，。；]/.test(trimmedLine))
        ) {
          resultNodes.push(
            <h1 key={`title-${index}`} className={docTitleClasses}>
              {trimmedLine}
            </h1>
          );
        }
        // 4. 其他情况：作为普通前言段落 (带缩进)
        else {
          resultNodes.push(
            <p key={`preamble-${index}`} className={preambleClasses}>
              {trimmedLine}
            </p>
          );
        }
      } else {
        // 极其罕见的情况：在条文之外的孤立文本，也按前言样式处理，或者居中显示
        resultNodes.push(
          <p key={`orphan-${index}`} className="text-center text-neutral my-4">
            {trimmedLine}
          </p>
        );
      }
    });

    flushArticle();
    return resultNodes;
  };

  // --- 高亮动画逻辑 ---
  const triggerHighlight = (element: HTMLElement) => {
    element.classList.remove(
      "bg-yellow-100",
      "ring-2",
      "ring-yellow-300",
      "shadow-lg"
    );

    void element.offsetWidth;

    element.classList.add(
      "bg-warning/10",
      "ring-1",
      "ring-warning/30",
      "shadow-sm",
      "-mx-2",
      "px-2",
      "rounded-lg"
    );

    // 2.5秒后移除
    setTimeout(() => {
      element.classList.remove(
        "bg-warning/10",
        "ring-1",
        "ring-warning/30",
        "shadow-sm",
        "-mx-2",
        "px-2",
        "rounded-lg"
      );
    }, 2500);
  };

  useEffect(() => {
    if (!isLoading && fullText && contentRef.current) {
      if (law.article_number && law.article_number !== "全文") {
        const targetId = `article-${law.article_number}`;
        setTimeout(() => {
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            triggerHighlight(targetElement);
          }
        }, 100);
      }
    }
  }, [isLoading, fullText, law.article_number]);

  return (
    <motion.div
      className="modal modal-open"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-box w-11/12 max-w-6xl h-[90vh] flex flex-row p-0 bg-base-100 shadow-2xl overflow-hidden"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {toc.length > 0 && (
          <div className="w-64 bg-base-200/50 border-r border-base-300 h-full overflow-y-auto p-4 hidden lg:block shrink-0">
            <h4 className="font-bold text-sm mb-4 text-base-content/50">
              目录导航
            </h4>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById(item.id)
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`block text-xs py-1 hover:text-primary truncate ${
                      item.level === 1
                        ? "font-black text-base-content text-sm mt-2" // 编：最粗，间距大
                        : item.level === 1.5
                        ? "font-bold text-base-content/90 pl-2 mt-1" // 分编：粗，微缩进
                        : "pl-6 text-base-content/70" // 章：普通缩进
                    }`}
                    title={item.text}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grow relative flex flex-col h-full">
          <header className="px-6 py-4 border-b border-base-200 flex justify-between items-center shrink-0 bg-base-100/80 backdrop-blur sticky top-0 z-10">
            <div>
              <h3 className="font-extrabold text-xl text-base-content">
                {law.law_name}
              </h3>
              {law.article_number !== "全文" && (
                <span className="text-xs text-base-content font-mono mt-1 block ">
                  定位至：{law.article_number}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost hover:bg-base-200"
            >
              <X size={22} />
            </button>
          </header>

          <div
            ref={contentRef}
            className="relative grow p-6 md:p-10 overflow-y-auto scroll-smooth"
          >
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral">
                <LoaderCircle className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm">正在调取卷宗...</p>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="alert alert-error max-w-md mx-auto mt-20"
              >
                <ServerCrash />
                <span>{error}</span>
              </div>
            )}

            {!isLoading && !error && (
              <article className="max-w-3xl mx-auto pb-20">
                {renderFormattedText(fullText)}
              </article>
            )}

            <AnimatePresence>
              {popoverState.visible && (
                <CustomPopover
                  content={popoverState.content}
                  top={popoverState.top}
                  left={popoverState.left}
                  onMouseEnter={() => {
                    if (hideTimeoutRef.current)
                      clearTimeout(hideTimeoutRef.current);
                  }}
                  onMouseLeave={() => {
                    hideTimeoutRef.current = window.setTimeout(() => {
                      setPopoverState((prev) => ({ ...prev, visible: false }));
                    }, 200);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
