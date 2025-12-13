// src/components/DraftingView.tsx

import React, { useState, useRef, useEffect, useMemo } from "react";
import { startChatStream, stopTask } from "../services/api";
import { 
  Trash2, Sparkles, Send, FileText, Save, Plus, X, 
  Copy, Eraser, LayoutTemplate, Library, ChevronRight, BrainCircuit, ChevronDown,
  FileCode, FileType, ClipboardCopy, Square
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDrafting } from "../hooks/useDrafting";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "./ConfirmModal";

export const DraftingView: React.FC = () => {
  const { materials, templates, removeMaterial, clearMaterials, saveTemplate, removeTemplate } = useDrafting();
  
  const [prompt, setPrompt] = useState("");
  const [rawResult, setRawResult] = useState(""); 
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [sidebarTab, setSidebarTab] = useState<'materials' | 'templates'>('materials');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [isThoughtOpen, setIsThoughtOpen] = useState(true);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const eventIdRef = useRef<string | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  // === 解析思考内容 ===
  const { thought, content } = useMemo(() => {
    const thinkMatch = rawResult.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    const thoughtContent = thinkMatch ? thinkMatch[1].trim() : "";
    let mainContent = rawResult.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    
    if (isGenerating && rawResult.includes("<think>") && !rawResult.includes("</think>")) {
        mainContent = ""; 
    }
    return { thought: thoughtContent, content: mainContent };
  }, [rawResult, isGenerating]);

  // 自动滚动
  useEffect(() => {
    if (isGenerating) {
      resultEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [rawResult, isGenerating]);

  // 组件卸载清理
  useEffect(() => {
    return () => { if (eventIdRef.current) stopTask(eventIdRef.current); };
  }, []);

  // === 核心生成逻辑 ===
  const handleGenerate = async () => {
    if (!prompt.trim() || materials.length === 0) {
        if(materials.length === 0) toast.error("请先添加素材");
        return;
    }
    
    setIsGenerating(true); 
    setRawResult(""); 
    setIsThoughtOpen(true);
    
    if (eventIdRef.current) await stopTask(eventIdRef.current);
    const currentEventId = `draft-${Date.now()}`;
    eventIdRef.current = currentEventId;

    const contextStrings = materials.map(
        i => `【${i.law_name} ${i.article_number}】\n${i.content}`
    );

    try {
        await startChatStream(prompt, contextStrings, "draft", (token) => {
            if (token === "[DONE]") {
                setIsGenerating(false); 
                eventIdRef.current = null;
            } else if (token.startsWith("[Error:")) {
                toast.error("生成出错: " + token);
                setIsGenerating(false);
            } else {
                setRawResult(prev => prev + token);
            }
        }, currentEventId);
    } catch(e) {
        toast.error("启动失败");
        setIsGenerating(false);
    }
  };

  const handleStop = async () => {
      if (eventIdRef.current) {
          await stopTask(eventIdRef.current);
          setIsGenerating(false); 
          toast("已停止生成", { icon: "🛑" });
      }
  };

  // === 复制逻辑 ===
  const handleCopy = async (type: 'md' | 'text' | 'html') => {
      if (!content) return;

      try {
          if (type === 'md') {
              await navigator.clipboard.writeText(content);
              toast.success("Markdown 源码已复制");
          } else if (type === 'text') {
              if (articleRef.current) {
                  await navigator.clipboard.writeText(articleRef.current.innerText);
                  toast.success("纯文本已复制");
              }
          } else if (type === 'html') {
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
                  toast.success("带格式内容已复制 (可直接粘贴到 Word)");
              }
          }
      } catch (e) {
          console.error(e);
          toast.error("复制失败，请重试");
      }
  };

  const handleRequestClear = () => setShowClearConfirm(true);
  
  const performClear = () => {
      setRawResult("");
      setShowClearConfirm(false);
      toast.success("内容已清空");
  };

  const applyTemplate = (c: string) => { 
      if (!prompt.trim()) setPrompt(c); 
      else { setPrompt(prev => prev + "\n\n" + c); toast.success("模版已追加"); } 
  };
  
  const handleSaveTemplate = async () => { 
      if (!newTemplateName.trim()) { toast.error("请输入模版名称"); return; }
      if (!newTemplateContent.trim()) { toast.error("模版内容不能为空"); return; }

      try {
        await saveTemplate(newTemplateName, newTemplateContent); 
        setShowTemplateModal(false); 
        setNewTemplateName(""); 
        setNewTemplateContent(""); 
        toast.success("模版已保存"); 
      } catch(e) {
        toast.error("保存失败");
      }
  };

  return (
    <div className="flex h-full bg-base-100 overflow-hidden">
      
      {/* === 左侧资源栏 === */}
      <div className="w-80 border-r border-base-200 bg-base-200/30 flex flex-col shrink-0">
         <div className="flex border-b border-base-200 bg-base-100">
            <button onClick={() => setSidebarTab('materials')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${sidebarTab === 'materials' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:bg-base-200'}`}><Library size={14} /> 引用素材 ({materials.length})</button>
            <button onClick={() => setSidebarTab('templates')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${sidebarTab === 'templates' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:bg-base-200'}`}><LayoutTemplate size={14} /> 常用模版</button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sidebarTab === 'materials' ? (
                <>
                   {materials.length > 0 && <div className="flex justify-end"><button onClick={clearMaterials} className="text-xs text-error hover:underline mb-2">清空全部</button></div>}
                   {materials.map(item => (
                       <div key={item.id} className="card card-compact bg-base-100 border border-base-200 shadow-sm text-xs p-3 relative group">
                           <div className="font-bold pr-6">{item.law_name} {item.article_number}</div>
                           <p className="line-clamp-2 opacity-60 mt-1">{item.content}</p>
                           <button onClick={() => removeMaterial(item.law_id)} className="absolute top-2 right-2 text-base-content/20 hover:text-error opacity-0 group-hover:opacity-100"><X size={14}/></button>
                       </div>
                   ))}
                   {materials.length === 0 && <div className="text-center py-10 opacity-40 text-xs">暂无素材</div>}
                </>
            ) : (
                <>
                   <button onClick={() => setShowTemplateModal(true)} className="btn btn-sm btn-outline btn-block border-dashed border-base-content/20 font-normal mb-4"><Plus size={14} /> 新建模版</button>
                   {templates.map(t => (
                       <div key={t.id} className="group flex items-center justify-between p-3 bg-base-100 border border-base-200 rounded-lg hover:border-primary/50 cursor-pointer" onClick={() => applyTemplate(t.content)}>
                           <div className="flex items-center gap-2 overflow-hidden"><FileText size={14} className="text-primary/70 shrink-0"/><span className="text-xs truncate">{t.name}</span></div>
                           <button onClick={(e) => { e.stopPropagation(); removeTemplate(t.id); }} className="p-1 hover:text-error opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                       </div>
                   ))}
                </>
            )}
         </div>
      </div>

      {/* === 右侧工作区 === */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-base-100 relative">
         
         {/* 1. 工具栏 */}
         <div className="h-14 border-b border-base-200 flex items-center justify-between px-6 bg-base-100 shrink-0 z-10">
             <div className="flex items-center gap-2">
                 <Sparkles size={16} className="text-primary"/>
                 <div className="font-bold text-sm">文书生成</div>
             </div>
             
             <div className="flex items-center gap-2">
                 {content && !isGenerating ? (
                     <>
                        <div className="tooltip tooltip-bottom" data-tip="清空">
                            <button onClick={handleRequestClear} className="btn btn-sm btn-ghost btn-square text-base-content/50 hover:text-error">
                                <Eraser size={16}/>
                            </button>
                        </div>
                        
                        <div className="h-4 w-px bg-base-300 mx-1"></div>

                        <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="btn btn-sm btn-primary gap-2 px-3 shadow-sm font-normal">
                                <Copy size={14}/> 复制结果
                            </div>
                            <ul tabIndex={0} className="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 rounded-box w-48 border border-base-200 text-xs mt-1">
                                <li><a onClick={() => handleCopy('html')} className="py-2"><ClipboardCopy size={14} className="text-success" /> <span>带格式复制 (Word)</span></a></li>
                                <li><a onClick={() => handleCopy('text')} className="py-2"><FileType size={14} className="text-base-content/70" /> <span>复制纯文本</span></a></li>
                                <div className="divider my-0"></div>
                                <li><a onClick={() => handleCopy('md')} className="py-2"><FileCode size={14} className="text-warning" /> <span>复制 Markdown</span></a></li>
                            </ul>
                        </div>
                     </>
                 ) : isGenerating ? (
                     // 生成中显示顶部停止按钮
                     <button onClick={handleStop} className="btn btn-sm btn-error gap-2 animate-pulse text-white shadow-md">
                         <Square size={12} className="fill-current"/> 停止
                     </button>
                 ) : null}
             </div>
         </div>

         {/* 2. 结果展示区 */}
         <div className="flex-1 overflow-y-auto bg-base-200/50 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-4">
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
                            <span className="text-xs font-bold text-base-content/70 flex-1">深度思考过程</span>
                            {isThoughtOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </div>
                        {isThoughtOpen && (
                            <div className="p-4 text-xs font-mono text-base-content/60 bg-base-100 border-t border-base-200 whitespace-pre-wrap leading-relaxed">
                                {thought}
                            </div>
                        )}
                    </motion.div>
                )}
                </AnimatePresence>

                <div className={`bg-base-100 shadow-sm border border-base-200 rounded-xl p-8 md:p-12 min-h-[500px] transition-all ${!content && !isGenerating ? 'flex flex-col items-center justify-center' : ''}`}>
                    {(content || isGenerating) ? (
                        <article ref={articleRef} className="prose prose-sm md:prose-base max-w-none prose-headings:font-bold prose-headings:text-base-content prose-p:text-base-content/80">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                            {isGenerating && !content && !thought && <span className="loading loading-dots loading-sm text-primary"></span>}
                            <div ref={resultEndRef}></div>
                        </article>
                    ) : (
                        <div className="text-center opacity-40">
                            <FileText size={40} className="mx-auto mb-4" />
                            <p>输入具体要求，或从左侧载入模版开始起草文书</p>
                        </div>
                    )}
                </div>
            </div>
         </div>

         {/* 3. 底部输入区 */}
         <div className="p-4 bg-base-100 border-t border-base-200 shrink-0 z-20 shadow-sm">
            <div className="max-w-4xl mx-auto relative">
               <textarea 
                  className="textarea textarea-bordered w-full h-28 pr-32 resize-none focus:outline-none font-mono text-sm disabled:opacity-60 disabled:bg-base-200"
                  placeholder="请输入具体要求，例如：请根据提供的法条撰写一份《辞退通知书》。 按下 Ctrl + Enter 开始起草"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={isGenerating}
                  onKeyDown={e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isGenerating) handleGenerate(); }}
               />
               <div className="absolute bottom-3 right-3 flex gap-2">
                   {isGenerating ? (
                       // 显示停止按钮
                       <button onClick={handleStop} className="btn btn-sm btn-error gap-2 px-6 shadow-md animate-pulse">
                           <Square size={12} className="fill-current"/> 停止
                       </button>
                   ) : (
                       <button className="btn btn-sm btn-primary gap-2 px-6 shadow-md" onClick={handleGenerate} disabled={materials.length === 0 || !prompt.trim()}>
                          <Send size={16} /> 起草
                       </button>
                   )}
               </div>
               {!isGenerating && (
                   <button onClick={() => setShowTemplateModal(true)} className="absolute top-2 right-2 btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-primary" title="保存为模版">
                       <Save size={14}/>
                   </button>
               )}
            </div>
         </div>
      </div>

      {/* 模版弹窗 */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="modal modal-open z-50">
            <div className="modal-backdrop" onClick={() => setShowTemplateModal(false)}></div>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="modal-box bg-base-100 shadow-2xl border border-base-200"
            >
                <h3 className="font-bold text-lg mb-4">保存为模版</h3>
                <input type="text" placeholder="模版名称" className="input input-bordered w-full mb-3" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                <textarea className="textarea textarea-bordered w-full h-32" placeholder="内容..." value={newTemplateContent || prompt} onChange={e => setNewTemplateContent(e.target.value)}></textarea>
                <div className="modal-action">
                    <button className="btn" onClick={() => setShowTemplateModal(false)}>取消</button>
                    <button className="btn btn-primary" onClick={handleSaveTemplate}>保存</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 确认弹窗 */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="清空内容"
        message="确定要清空当前生成的内容吗？此操作无法撤销。"
        confirmText="确定清空"
        cancelText="取消"
        type="warning"
        onConfirm={performClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};