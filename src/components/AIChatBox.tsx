import React, { useState, useEffect } from "react";
import { Sparkles, Bot, AlertCircle, FileText } from "lucide-react";
import { startChatStream, getSettings } from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIChatBoxProps {
  query: string;
  results: any[];
  mode?: "simple" | "deep";
}

export const AIChatBox: React.FC<AIChatBoxProps> = ({
  query,
  results,
  mode = "simple",
}) => {
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((settings) => {
      setIsEnabled(settings.enable_ai_chat);
    });
  }, []);

  useEffect(() => {
    if (!isEnabled || !query || results.length === 0) return;

    let unlisten: (() => void) | undefined;
    let isActive = true;

    const start = async () => {
      setAnswer("");
      setError(null);
      setIsStreaming(true);

      try {
        const contextChunks = results.map(
          (r) => `法规：${r.law_name} ${r.article_number}\n内容：${r.content}`
        );

        unlisten = await startChatStream(
          query,
          contextChunks,
          mode,
          (token) => {
            if (token.startsWith("[Error:")) {
              setError(token);
              setIsStreaming(false);
            } else {
              setAnswer((prev) => prev + token);
            }
          }
        );
      } catch (e) {
        setError("无法连接 AI 服务");
        setIsStreaming(false);
      }
    };

    start();

    return () => {
      isActive = false; 
      if (unlisten) unlisten();
      setIsStreaming(false);
    };
  }, [query, results, isEnabled, mode]);

  if (!isEnabled) return null;

  return (
    <div
      className={`card border mb-6 shadow-sm overflow-hidden transition-colors ${
        mode === "deep"
          ? "bg-primary/5 border-primary/20"
          : "bg-base-200/40 border-base-300"
      }`}
    >
      <div className="card-body py-4 px-5">
        <h3
          className={`font-bold flex items-center gap-2 text-sm select-none mb-2 ${
            mode === "deep" ? "text-primary" : "text-base-content/80"
          }`}
        >
          {mode === "deep" ? <FileText size={16} /> : <Sparkles size={16} />}
          {mode === "deep" ? "AI 法律检索报告" : "AI 助手归纳"}
          {isStreaming && (
            <span className="loading loading-dots loading-xs opacity-50"></span>
          )}
        </h3>

        {error ? (
          <div className="text-error text-xs flex items-center gap-2 bg-error/10 p-2 rounded">
            <AlertCircle size={14} /> {error}
          </div>
        ) : (
          <div
            className="text-base-content/90 animate-in fade-in prose prose-sm max-w-none 
              prose-headings:font-bold prose-headings:text-base-content prose-headings:mt-4 prose-headings:mb-2 
              prose-p:text-base-content/90 prose-p:leading-relaxed prose-p:my-2
              prose-li:text-base-content/90 prose-li:my-0.5
              prose-strong:text-primary prose-strong:font-bold"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        )}

        {!isStreaming && answer && (
          <div className="text-xs text-base-content/40 mt-4 pt-3 border-t border-base-content/5 flex items-center gap-1 select-none">
            <Bot size={12} />
            <span>AI 生成内容仅供参考，法律决策请咨询专业律师。</span>
          </div>
        )}
      </div>
      {isStreaming && (
        <div className="h-0.5 w-full bg-base-content/5 overflow-hidden">
          <div
            className={`h-full w-1/3 animate-[progress_1s_ease-in-out_infinite_alternate] ${
              mode === "deep" ? "bg-primary" : "bg-base-content/20"
            }`}
          ></div>
        </div>
      )}
    </div>
  );
};
