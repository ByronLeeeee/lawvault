import React, { useState, useEffect } from "react";
import { Sparkles, Bot, AlertCircle } from "lucide-react";
import { startChatStream, getSettings } from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIChatBoxProps {
  query: string;
  results: any[];
}

export const AIChatBox: React.FC<AIChatBoxProps> = ({ query, results }) => {
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

    const start = async () => {
      setAnswer("");
      setError(null);
      setIsStreaming(true);

      try {
        const contextChunks = results.map(
          (r) => `法规：${r.law_name} ${r.article_number}\n内容：${r.content}`
        );

        unlisten = await startChatStream(query, contextChunks, (token) => {
          if (token.startsWith("[Error:")) {
            setError(token);
            setIsStreaming(false);
          } else {
            setAnswer((prev) => prev + token);
          }
        });
      } catch (e) {
        setError("无法连接 AI 服务");
        setIsStreaming(false);
      }
    };

    start();

    return () => {
      if (unlisten) unlisten();
      setIsStreaming(false);
    };
  }, [query, results, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div className="card bg-base-200/40 border border-primary/10 mb-6 shadow-sm overflow-hidden">
      <div className="card-body py-4 px-5">
        <h3 className="font-bold text-primary flex items-center gap-2 text-sm select-none mb-2">
          <Sparkles size={16} />
          AI 法律助手分析
          {isStreaming && (
            <span className="loading loading-dots loading-xs text-primary/50"></span>
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
              prose-strong:text-primary prose-strong:font-bold
              prose-code:text-primary prose-code:bg-base-300 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
          >
            {!answer && isStreaming && (
              <span className="opacity-50 text-sm">正在思考并整理法条...</span>
            )}

            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        )}

        {!isStreaming && answer && (
          <div className="text-xs text-base-content/40 mt-4 pt-3 border-t border-base-content/5 flex items-center gap-1 select-none">
            <Bot size={12} />
            <span>AI 生成内容仅供参考，请务必核对下方原文。</span>
          </div>
        )}
      </div>
      {isStreaming && (
        <div className="h-0.5 w-full bg-primary/20 overflow-hidden">
          <div className="h-full bg-primary w-1/3 animate-[progress_1s_ease-in-out_infinite_alternate]"></div>
        </div>
      )}
    </div>
  );
};
