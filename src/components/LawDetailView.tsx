// src/components/LawDetailView.tsx

import React, { useState, useEffect, useRef } from "react";
import { getArticleSnippet, getFullText, LawChunk } from "../services/api";
import { AnimatePresence } from "framer-motion";
import { LoaderCircle, ServerCrash, Copy, Check } from "lucide-react";
import { CustomPopover } from "./CustomPopover";

interface LawDetailViewProps {
  law: LawChunk;
}

interface TOCItem {
  id: string;
  text: string;
  level: 1 | 1.5 | 2 | 3;
}

// --- 样式常量 ---
const partClasses =
  "text-3xl font-black text-center mt-16 mb-8 text-base-content tracking-widest";
const subPartClasses =
  "text-2xl font-extrabold text-center mt-14 mb-7 text-base-content/95 tracking-wider scroll-mt-20";
const chapterClasses =
  "text-2xl font-bold text-center mt-12 mb-6 text-base-content/90 tracking-wide";
const sectionClasses =
  "text-xl font-bold text-left mt-8 mb-4 pl-4 border-l-4 border-primary text-base-content/80";
const articleContainerClasses =
  "mb-2 py-2 px-2 rounded-lg transition-colors duration-500";
const articleLabelClasses = "font-bold mr-2 text-base-content select-none";
const paragraphClasses =
  "mb-2 text-lg leading-8 text-justify text-base-content/80 indent-8";
const docTitleClasses =
  "text-3xl lg:text-4xl font-black text-center mt-8 mb-6 text-base-content select-none";
const docMetaClasses =
  "text-lg text-center text-base-content/60 mb-12 font-serif";
const centerTitleClasses =
  "text-2xl font-bold text-center mt-8 mb-8 text-base-content";
const preambleClasses =
  "text-lg leading-8 text-base-content/70 mb-4 px-4 lg:px-10 font-serif indent-8 text-justify";

export const LawDetailView: React.FC<LawDetailViewProps> = ({ law }) => {
  const [fullText, setFullText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedArticleId, setCopiedArticleId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TOCItem[]>([]);

  // Popover State
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

  // TOC Generation
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

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (
          firstArticleLineIndex === -1 &&
          /^\s*第[一二三四五六七八九十百]+条/.test(trimmed)
        ) {
          firstArticleLineIndex = index;
        }

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

      if (firstArticleLineIndex === -1) {
        setToc(allHeaders as any);
        return;
      }

      const postBodyHeaders = allHeaders.filter(
        (h) => h.lineIndex >= firstArticleLineIndex
      );
      const preBodyHeaders = allHeaders.filter(
        (h) => h.lineIndex < firstArticleLineIndex
      );
      const keptPreHeaders: typeof allHeaders = [];
      let currentLevelLimit = 100;

      for (let i = preBodyHeaders.length - 1; i >= 0; i--) {
        const header = preBodyHeaders[i];
        if (header.level < currentLevelLimit) {
          keptPreHeaders.unshift(header);
          currentLevelLimit = header.level;
        }
        if (currentLevelLimit === 1) break;
      }

      setToc([...keptPreHeaders, ...postBodyHeaders] as any);
    }
  }, [fullText]);

  const handleCopy = (articleId: string, content: string) => {
    const artNum = articleId.replace("article-", "");
    const textToCopy = `《${law.law_name}》${artNum}：\n${content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedArticleId(articleId);
    setTimeout(() => setCopiedArticleId(null), 1500);
  };

  const fetchPopoverContent = async (
    lawNameRef: string | undefined,
    artNum: string
  ) => {
    setPopoverState((prev) => ({
      ...prev,
      visible: true,
      content: "正在查找条文...",
    }));
    // 如果正则没捕获到法名，或者法名包含特定的自我引用表述，则视为当前法律
    const SELF_REFERENCE_PATTERNS =
      /^(本法|本实施条例|本办法|本规定|本条例|本细则|本规则|本办法实施细则)$/;
    let targetLaw = null;
    if (lawNameRef && !SELF_REFERENCE_PATTERNS.test(lawNameRef)) {
      targetLaw = lawNameRef;
    }
    const content = await getArticleSnippet(targetLaw, artNum, law.law_name);
    setPopoverState((prev) => ({ ...prev, content: content }));
  };

  const cleanLawName = (raw: string | undefined): string | null => {
    if (!raw) return null;
    if (raw.startsWith("《") && raw.endsWith("》"))
      return raw.replace(/[《》]/g, "");
    if (raw === "本法") return null;
    const stopWords = [
      "根据",
      "违反",
      "适用",
      "照",
      "执行",
      "于",
      "实施",
      "履行", // 动词
      "的",
      "在",
      "与",
      "和",
      "及",
      "向",
      "对",
      "为",
      "是", // 介词/连词
    ];
    let cleaned = raw;
    for (const word of stopWords) {
      if (cleaned.includes(word)) {
        cleaned = cleaned.split(word).pop() || cleaned;
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
      let currentLawName = cleanLawName(rawLawGroup);
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

      const startIndex = match.index!;
      let effectiveLawName = currentLawName;

      if (i > 0) {
        const prevMatch = matches[i - 1];
        const prevEnd = prevMatch.index! + prevMatch[0].length;
        const gap = paragraphText.substring(prevEnd, startIndex).trim();
        if (!currentLawName && /^[、，,和及\s]+$/.test(gap)) {
          effectiveLawName = lastContextLawName;
        }
      }

      if (currentLawName) lastContextLawName = currentLawName;
      else if (!effectiveLawName) lastContextLawName = null;

      if (startIndex > lastIndex)
        result.push(paragraphText.substring(lastIndex, startIndex));
      if (prefix) result.push(prefix);

      result.push(
        <a
          key={`${paraKey}-match-${i}`}
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

            let left =
              rect.left -
              containerRect.left +
              rect.width / 2 -
              popoverWidth / 2;
            if (left < padding) left = padding;
            else if (left + popoverWidth > containerRect.width - padding)
              left = containerRect.width - popoverWidth - padding;
            left += container.scrollLeft;

            let top =
              rect.bottom - containerRect.top + container.scrollTop + 10;
            const viewportHeight = window.innerHeight;
            if (rect.bottom + popoverHeight > viewportHeight - 20) {
              top =
                rect.top -
                containerRect.top +
                container.scrollTop -
                popoverHeight -
                10;
            }

            setPopoverState({ visible: true, content: "加载中...", top, left });
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
              const el = document.getElementById(targetId);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                triggerHighlight(el);
              }
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

  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    const resultNodes: React.ReactNode[] = [];
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

      const articleMatch = trimmedLine.match(articlePattern);
      if (articleMatch) {
        flushArticle();
        isPreamble = false;
        currentArticleId = `article-${articleMatch[1]}`;
        currentArticleContent.push(trimmedLine);
        return;
      }

      if (currentArticleId) {
        currentArticleContent.push(trimmedLine);
      } else if (isPreamble) {
        if (/^目\s*录$/.test(trimmedLine)) {
          resultNodes.push(
            <h2 key={`toc-title-${index}`} className={centerTitleClasses}>
              {trimmedLine}
            </h2>
          );
        } else if (
          /^[（(].*[）)]$/.test(trimmedLine) ||
          trimmedLine.endsWith("通过")
        ) {
          resultNodes.push(
            <div key={`meta-${index}`} className={docMetaClasses}>
              {trimmedLine}
            </div>
          );
        } else if (
          trimmedLine === law.law_name ||
          (trimmedLine.length < 30 && !/[，。；]/.test(trimmedLine))
        ) {
          resultNodes.push(
            <h1 key={`title-${index}`} className={docTitleClasses}>
              {trimmedLine}
            </h1>
          );
        } else {
          resultNodes.push(
            <p key={`preamble-${index}`} className={preambleClasses}>
              {trimmedLine}
            </p>
          );
        }
      } else {
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
    <div className="flex flex-row h-full w-full bg-base-100 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {toc.length > 0 && (
        <div className="w-64 bg-base-200/50 border-r border-base-300 h-full overflow-y-auto p-4 hidden xl:block shrink-0">
          <h4 className="font-bold text-sm mb-4 text-base-content/50 uppercase tracking-wider">
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
                  className={`block text-xs py-1 hover:text-primary truncate transition-colors ${
                    item.level === 1
                      ? "font-black text-base-content text-sm mt-2"
                      : item.level === 1.5
                      ? "font-bold text-base-content/90 pl-2 mt-1"
                      : "pl-6 text-base-content/70"
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

      <div className="grow relative flex flex-col h-full min-w-0">
        <header className="px-8 py-4 border-b border-base-200 shrink-0 bg-base-100/95 backdrop-blur z-10 flex items-center justify-between">
          <div>
            <h3
              className="font-extrabold text-xl text-base-content truncate max-w-2xl"
              title={law.law_name}
            >
              {law.law_name}
            </h3>
            {law.article_number !== "全文" && (
              <span className="text-xs text-primary font-mono mt-1 block">
                定位至：{law.article_number}
              </span>
            )}
          </div>
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
    </div>
  );
};
