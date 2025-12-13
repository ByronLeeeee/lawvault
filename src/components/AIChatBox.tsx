// src/components/AIChatBox.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, Bot, AlertCircle, FileText, Square, BrainCircuit } from "lucide-react";
import { startChatStream, getSettings, stopChat } from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIChatBoxProps {
  query: string;
  results: any[];
  mode?: "simple" | "deep";
}

export const AIChatBox: React.FC<AIChatBoxProps> = ({ query, results, mode = "simple" }) => {
  const [rawOutput, setRawOutput] = useState(""); 
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
  
  const eventIdRef = useRef<string | null>(null);

  useEffect(() => {
    getSettings().then((settings) => setIsEnabled(settings.enable_ai_chat));
  }, []);

  const handleStop = async () => {
    if (eventIdRef.current) {
      await stopChat(eventIdRef.current);
      setIsStreaming(false);
    }
  };

  const { thought, content } = useMemo(() => {
    const thinkMatch = rawOutput.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    const thoughtContent = thinkMatch ? thinkMatch[1].trim() : "";
    let mainContent = rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    
    if (rawOutput.includes("<think>") && !rawOutput.includes("</think>")) {
        mainContent = ""; 
    }

    return { thought: thoughtContent, content: mainContent };
  }, [rawOutput]);

  const showThought = isThoughtExpanded || (isStreaming && !content && !!thought);

  useEffect(() => {
    if (!isEnabled || !query || results.length === 0) return;

    let unlisten: (() => void) | undefined;
    const currentEventId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    eventIdRef.current = currentEventId;

    const start = async () => {
      setRawOutput("");
      setError(null);
      setIsStreaming(true);
      setIsThoughtExpanded(true);

      try {
        const contextChunks = results.map(
          (r) => `法规：${r.law_name} ${r.article_number}\n内容：${r.content}`
        );

        unlisten = await startChatStream(query, contextChunks, mode, (token) => {
          if (token === "[DONE]") {
             setIsStreaming(false); 
          } else if (token.startsWith("[Error:")) {
            setError(token);
            setIsStreaming(false);
          } else {
            setRawOutput((prev) => prev + token);
          }
        }, currentEventId);
      } catch (e) {
        setError("无法连接 AI 服务");
        setIsStreaming(false);
      }
    };

    start();

    return () => {
      if (unlisten) unlisten();
      if (eventIdRef.current) stopChat(eventIdRef.current);
      setIsStreaming(false);
    };
  }, [query, results, isEnabled, mode]);

  if (!isEnabled) return null;

  return (
    <div className={`card border mb-6 shadow-sm overflow-hidden transition-all ${
        mode === "deep" ? "bg-primary/5 border-primary/20" : "bg-base-200/40 border-base-300"
    }`}>
      <div className="card-body py-4 px-5">
        
        <div className="flex justify-between items-center mb-3">
            <h3 className={`font-bold flex items-center gap-2 text-sm select-none ${
                mode === "deep" ? "text-primary" : "text-base-content/80"
            }`}>
              {mode === "deep" ? <FileText size={16} /> : <Sparkles size={16} />}
              {mode === "deep" ? "AI 法律检索报告" : "AI 助手简评"}
              {isStreaming && <span className="loading loading-dots loading-xs opacity-50"></span>}
            </h3>
            
            {isStreaming && (
                <button onClick={handleStop} className="btn btn-xs btn-ghost text-error gap-1 hover:bg-error/10 transition-colors">
                    <Square size={12} className="fill-current" /> 停止生成
                </button>
            )}
        </div>

        {error ? (
          <div className="text-error text-xs flex items-center gap-2 bg-error/10 p-2 rounded">
            <AlertCircle size={14} /> {error}
          </div>
        ) : (
          <div className="space-y-3">
            
            {/* 1. 思考过程 */}
            {thought && (
                <div className="collapse collapse-arrow bg-base-100/50 border border-base-content/5 rounded-lg overflow-hidden shadow-sm">
                    <input 
                        type="checkbox" 
                        checked={showThought} 
                        onChange={() => setIsThoughtExpanded(!isThoughtExpanded)} 
                    /> 
                    <div className="collapse-title text-xs font-medium flex items-center gap-2 py-2 min-h-0 text-base-content/60">
                        <BrainCircuit size={14} />
                        {isStreaming && !content ? "正在深度思考..." : "思考过程"}
                    </div>
                    <div className="collapse-content text-xs text-base-content/70 font-mono leading-relaxed bg-base-200/30">
                        <div className="pt-2 whitespace-pre-wrap break-all">{thought}</div>
                    </div>
                </div>
            )}

            {/* 2. 正文展示区 */}
            <div className="
                w-full 
                text-base-content/90 animate-in fade-in 
                prose prose-sm max-w-none 
                prose-headings:text-base-content 
                prose-p:text-base-content/90 
                prose-strong:text-primary 
                max-h-96 overflow-y-auto overflow-x-hidden 
                break-all whitespace-pre-wrap 
                custom-scrollbar pr-2
            ">
              
              {!content && isStreaming && !thought && <span className="opacity-50 text-xs">正在分析法律依据...</span>}
              
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </div>
        )}

        {!isStreaming && content && (
          <div className="text-xs text-base-content/40 mt-2 pt-3 border-t border-base-content/5 flex items-center gap-1 select-none">
            <Bot size={12} />
            <span>AI 生成内容仅供参考，法律决策请咨询专业律师。</span>
          </div>
        )}
      </div>
    </div>
  );
};