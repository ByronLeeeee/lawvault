import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  startChatStream,
  stopTask,
  startAgentSearch,
  AgentUpdateEvent,
} from "../services/api";
import {
  Trash2,
  Sparkles,
  Send,
  FileText,
  Download,
  Save,
  Plus,
  X,
  Copy,
  Eraser,
  LayoutTemplate,
  Library,
  ChevronRight,
  BrainCircuit,
  ChevronDown,
  FileCode,
  FileType,
  ClipboardCopy,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDrafting } from "../hooks/useDrafting";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "./ConfirmModal";
import { AgentView } from "./AgentView";
import { listen } from "@tauri-apps/api/event";

export const DraftingView: React.FC = () => {
  const {
    materials,
    templates,
    removeMaterial,
    clearMaterials,
    saveTemplate,
    removeTemplate,
    addMaterial,
  } = useDrafting();

  const [prompt, setPrompt] = useState("");
  const [rawResult, setRawResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAgentSearching, setIsAgentSearching] = useState(false);
  const [useAgentMode, setUseAgentMode] = useState(false);
  const [agentEvent, setAgentEvent] = useState<AgentUpdateEvent | null>(null);

  const [sidebarTab, setSidebarTab] = useState<"materials" | "templates">(
    "materials"
  );
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [isThoughtOpen, setIsThoughtOpen] = useState(true);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const eventIdRef = useRef<string | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

   useEffect(() => {
    const unlistenPromise = listen<AgentUpdateEvent>("agent-update", (e) => {
        setAgentEvent(e.payload);
    });
    
    return () => { 
        unlistenPromise.then(unlisten => unlisten()); 
    };
  }, []);

  const { thought, content } = useMemo(() => {
    const thinkMatch = rawResult.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    const thoughtContent = thinkMatch ? thinkMatch[1].trim() : "";
    let mainContent = rawResult.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    if (
      isGenerating &&
      rawResult.includes("<think>") &&
      !rawResult.includes("</think>")
    ) {
      mainContent = "";
    }
    return { thought: thoughtContent, content: mainContent };
  }, [rawResult, isGenerating]);

  useEffect(() => {
    if (isGenerating || isAgentSearching) {
      resultEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [rawResult, isGenerating, isAgentSearching, agentEvent]);

  useEffect(() => {
    return () => {
      if (eventIdRef.current) stopTask(eventIdRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!useAgentMode && materials.length === 0) {
      toast.error("请先添加素材，或开启“智能搜材”");
      return;
    }

    setIsGenerating(true);
    setRawResult("");
    setIsThoughtOpen(true);
    setAgentEvent(null);

    if (eventIdRef.current) await stopTask(eventIdRef.current);
    const currentEventId = `draft-${Date.now()}`;
    eventIdRef.current = currentEventId;

    try {
      let contextChunks: string[] = materials.map(
        (i) => `【${i.law_name} ${i.article_number}】\n${i.content}`
      );

      if (useAgentMode) {
        setIsAgentSearching(true);
        const foundMaterials = await startAgentSearch(prompt, currentEventId);
        setIsAgentSearching(false);

        if (foundMaterials.length > 0) {
          for (const m of foundMaterials) {
            await addMaterial(m);
          }

          const newChunks = foundMaterials.map(
            (i) => `【${i.law_name} ${i.article_number}】\n${i.content}`
          );

          contextChunks = Array.from(new Set([...contextChunks, ...newChunks]));
          toast.success(
            `智能搜材完成，引用了 ${foundMaterials.length} 条新依据`
          );
        } else {
          toast("未搜索到强相关法条，将基于现有素材写作", { icon: "⚠️" });
        }
      }

      await startChatStream(
        prompt,
        contextChunks,
        "draft",
        (token) => {
          if (token === "[DONE]") {
            setIsGenerating(false);
            eventIdRef.current = null;
          } else if (token.startsWith("[Error:")) {
            toast.error("生成出错: " + token);
            setIsGenerating(false);
          } else {
            setRawResult((prev) => prev + token);
          }
        },
        currentEventId
      );
    } catch (e) {
      const errStr = String(e);
      if (!errStr.includes("手动停止")) {
        toast.error("任务中断或出错");
      }
      setIsAgentSearching(false);
      setIsGenerating(false);
    }
  };

  const handleStop = async () => {
    if (eventIdRef.current) {
      await stopTask(eventIdRef.current);
      setIsGenerating(false);
      setIsAgentSearching(false);
      toast("已停止", { icon: "🛑" });
    }
  };


  const handleCopy = async (type: "md" | "text" | "html") => {
    if (!content) return;
    try {
      if (type === "md") {
        await navigator.clipboard.writeText(content);
        toast.success("Markdown 源码已复制");
      } else if (type === "text") {
        if (articleRef.current) {
          await navigator.clipboard.writeText(articleRef.current.innerText);
          toast.success("纯文本已复制");
        }
      } else if (type === "html") {
        if (articleRef.current) {
          const htmlContent = articleRef.current.innerHTML;
          const textContent = articleRef.current.innerText;
          const blobHtml = new Blob([htmlContent], { type: "text/html" });
          const blobText = new Blob([textContent], { type: "text/plain" });
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": blobHtml,
              "text/plain": blobText,
            }),
          ]);
          toast.success("带格式内容已复制");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("复制失败，请重试");
    }
  };

  const performClear = () => {
    setRawResult("");
    setShowClearConfirm(false);
    toast.success("内容已清空");
  };

  const performDeleteTemplate = async () => {
    if (templateToDelete) {
      await removeTemplate(templateToDelete.id);
      setTemplateToDelete(null);
      toast.success("模版已删除");
    }
  };

  const applyTemplate = (c: string) => {
    if (!prompt.trim()) setPrompt(c);
    else {
      setPrompt((prev) => prev + "\n\n" + c);
      toast.success("模版已追加");
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("请输入模版名称");
      return;
    }
    if (!newTemplateContent.trim()) {
      toast.error("模版内容不能为空");
      return;
    }
    try {
      await saveTemplate(newTemplateName, newTemplateContent);
      setShowTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateContent("");
      toast.success("模版已保存");
    } catch (e) {
      toast.error("保存失败");
    }
  };

  return (
    <div className="flex h-full bg-base-100 overflow-hidden">
      <div className="w-80 border-r border-base-200 bg-base-200/30 flex flex-col shrink-0">
        <div className="flex border-b border-base-200 bg-base-100">
          <button
            onClick={() => setSidebarTab("materials")}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              sidebarTab === "materials"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:bg-base-200"
            }`}
          >
            <Library size={14} /> 引用素材 ({materials.length})
          </button>
          <button
            onClick={() => setSidebarTab("templates")}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              sidebarTab === "templates"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:bg-base-200"
            }`}
          >
            <LayoutTemplate size={14} /> 常用模版
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {sidebarTab === "materials" ? (
            <>
              {materials.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearMaterials}
                    className="text-xs text-error hover:underline mb-2"
                  >
                    清空全部
                  </button>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {materials.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="card card-compact bg-base-100 border border-base-200 shadow-sm text-xs group hover:border-primary/40 transition-colors"
                  >
                    <div className="card-body p-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-base-content/90 leading-tight">
                          {item.law_name}{" "}
                          <span className="ml-1 font-normal text-primary">
                            {item.article_number}
                          </span>
                        </span>
                        <button
                          onClick={() => removeMaterial(item.law_id)}
                          className="text-base-content/20 hover:text-error transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <p className="line-clamp-3 opacity-60 mt-1 leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {materials.length === 0 && (
                <div className="text-center py-10 flex flex-col items-center gap-3 opacity-40">
                  <Library size={32} strokeWidth={1} />
                  <p className="text-xs">暂无素材，请在搜索结果中添加</p>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="btn btn-sm btn-outline btn-block border-dashed border-base-content/20 font-normal mb-4"
              >
                <Plus size={14} /> 新建模版
              </button>
              <div className="grid gap-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="group flex items-center justify-between p-3 bg-base-100 border border-base-200 rounded-lg hover:border-primary/50 cursor-pointer"
                    onClick={() => applyTemplate(t.content)}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText
                        size={16}
                        className="text-primary/70 shrink-0"
                      />
                      <span className="text-xs font-medium truncate">
                        {t.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTemplateToDelete({ id: t.id, name: t.name });
                      }}
                      className="p-1 hover:bg-error/10 hover:text-error rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {templates.length === 0 && (
                <div className="text-center py-10 opacity-40 text-xs">
                  暂无模版
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-base-100 relative">
        <div className="h-14 border-b border-base-200 flex items-center justify-between px-6 bg-base-100 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <div className="font-bold text-sm">文书生成</div>
          </div>
          <div className="flex gap-2">
            {content && !isGenerating ? (
              <>
                <div className="tooltip tooltip-bottom" data-tip="清空">
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="btn btn-sm btn-ghost btn-square text-base-content/50 hover:text-error"
                  >
                    <Eraser size={16} />
                  </button>
                </div>
                <div className="tooltip tooltip-bottom" data-tip="复制全文">
                  <button
                    onClick={() => handleCopy("text")}
                    className="btn btn-sm btn-ghost btn-square text-base-content/50"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="h-4 w-px bg-base-300 mx-1 my-auto"></div>
                <div className="dropdown dropdown-end">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-sm btn-outline gap-2 font-normal"
                  >
                    <Download size={14} /> 导出
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 rounded-box w-48 border border-base-200 text-xs mt-1"
                  >
                    <li>
                      <a onClick={() => handleCopy("html")} className="py-2">
                        <ClipboardCopy size={14} className="text-success" />{" "}
                        <span>带格式复制 (Word)</span>
                      </a>
                    </li>
                    <li>
                      <a onClick={() => handleCopy("text")} className="py-2">
                        <FileType size={14} className="text-base-content/70" />{" "}
                        <span>复制纯文本</span>
                      </a>
                    </li>
                    <div className="divider my-0"></div>
                    <li>
                      <a onClick={() => handleCopy("md")} className="py-2">
                        <FileCode size={14} className="text-warning" />{" "}
                        <span>复制 Markdown</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </>
            ) : isGenerating ? (
              <button
                onClick={handleStop}
                className="btn btn-sm btn-error gap-2 animate-pulse text-white shadow-md"
              >
                <Square size={12} className="fill-current" /> 停止
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-base-200/50 p-4 md:p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            {isAgentSearching && (
              <div className="mb-4">
                <AgentView event={agentEvent} isProcessing={true} />
              </div>
            )}

            <AnimatePresence>
              {thought && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-base-100 border border-info/20 rounded-xl overflow-hidden shadow-sm"
                >
                  <div
                    className="bg-info/5 px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-info/10 transition-colors"
                    onClick={() => setIsThoughtOpen(!isThoughtOpen)}
                  >
                    <BrainCircuit size={14} className="text-info" />
                    <span className="text-xs font-bold text-base-content/70 flex-1">
                      深度思考过程
                    </span>
                    {isThoughtOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </div>
                  {isThoughtOpen && (
                    <div className="p-4 text-xs font-mono text-base-content/60 bg-base-100 border-t border-base-200 whitespace-pre-wrap leading-relaxed wrap-break-word">
                      {thought}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={`bg-base-100 shadow-sm border border-base-200 rounded-xl p-8 md:p-12 min-h-[500px] transition-all ${
                !content && !isGenerating
                  ? "flex flex-col items-center justify-center"
                  : ""
              }`}
            >
              {content || isGenerating ? (
                <article
                  ref={articleRef}
                  className="prose prose-sm md:prose-base max-w-none prose-headings:font-bold prose-headings:text-base-content prose-p:text-base-content/80 wrap-break-word"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                  {isGenerating &&
                    !content &&
                    !thought &&
                    !isAgentSearching && (
                      <span className="loading loading-dots loading-sm text-primary"></span>
                    )}
                  <div ref={resultEndRef}></div>
                </article>
              ) : (
                <div className="text-center opacity-40">
                  <FileText size={40} className="mx-auto mb-4" />
                  <p>输入要求开始起草，或让AI自己搜索法条撰写。</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-base-100 border-t border-base-200 shrink-0 z-20 shadow-sm">
          <div className="max-w-4xl mx-auto relative">
            <textarea
              className="textarea textarea-bordered w-full h-28 pr-32 resize-none focus:outline-none font-mono text-sm disabled:opacity-60 disabled:bg-base-200"
              placeholder="输入要求开始起草，例如：请写一份辞退通知书；或直接勾选“智能搜材”功能，让AI自己搜索法条撰写。 按下 Ctrl + Enter 开始。"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.ctrlKey || e.metaKey) &&
                  !isGenerating
                )
                  handleGenerate();
              }}
            />
            <div className="absolute bottom-3 right-3 flex gap-2 items-center">
              {!isGenerating && (
                <div className="tooltip" data-tip="自动分析并搜索相关法条">
                  <label className="label cursor-pointer gap-2 bg-base-200/50 px-2 py-1 rounded-md hover:bg-base-200 transition-colors border border-base-200">
                    <span
                      className={`text-xs font-bold ${
                        useAgentMode ? "text-primary" : "text-base-content/50"
                      }`}
                    >
                      智能搜材
                    </span>
                    <input
                      type="checkbox"
                      className="toggle toggle-xs toggle-primary"
                      checked={useAgentMode}
                      onChange={(e) => setUseAgentMode(e.target.checked)}
                    />
                  </label>
                </div>
              )}

              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="btn btn-sm btn-error gap-2 px-6 shadow-md animate-pulse"
                >
                  <Square size={12} className="fill-current" /> 停止
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-primary gap-2 px-6 shadow-md"
                  onClick={handleGenerate}
                  disabled={
                    (materials.length === 0 && !useAgentMode) || !prompt.trim()
                  }
                >
                  <Send size={16} /> 起草
                </button>
              )}
            </div>
            {!isGenerating && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="absolute top-2 right-2 btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-primary"
                title="保存为模版"
              >
                <Save size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showTemplateModal && (
          <div className="modal modal-open z-50">
            <div
              className="modal-backdrop"
              onClick={() => setShowTemplateModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-box bg-base-100 shadow-2xl border border-base-200"
            >
              <h3 className="font-bold text-lg mb-4">保存为模版</h3>
              <input
                type="text"
                placeholder="模版名称"
                className="input input-bordered w-full mb-3"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <textarea
                className="textarea textarea-bordered w-full h-32"
                placeholder="内容..."
                value={newTemplateContent || prompt}
                onChange={(e) => setNewTemplateContent(e.target.value)}
              ></textarea>
              <div className="modal-action">
                <button
                  className="btn"
                  onClick={() => setShowTemplateModal(false)}
                >
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveTemplate}
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="清空内容"
        message="确定要清空当前生成的内容吗？"
        confirmText="清空"
        cancelText="取消"
        type="warning"
        onConfirm={performClear}
        onCancel={() => setShowClearConfirm(false)}
      />
      <ConfirmModal
        isOpen={!!templateToDelete}
        title="删除模版"
        message={`确定要删除模版 "${templateToDelete?.name}" 吗？`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={performDeleteTemplate}
        onCancel={() => setTemplateToDelete(null)}
      />
    </div>
  );
};
