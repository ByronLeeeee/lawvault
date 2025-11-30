// src/components/AgentView.tsx
import React, { useEffect, useRef } from "react";
import { AgentUpdateEvent } from "../services/api";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  CircleDashed, 
  Loader2, 
  BrainCircuit, 
  ListTodo} from "lucide-react";

interface AgentViewProps {
  event: AgentUpdateEvent | null;
  isProcessing: boolean;
}

export const AgentView: React.FC<AgentViewProps> = ({ event, isProcessing }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [event]);

  if (!event && !isProcessing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="card bg-base-100 border border-primary/20 shadow-md mb-6 overflow-hidden"
    >
      <div className="bg-primary/5 px-4 py-3 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          {isProcessing ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <BrainCircuit size={16} />
          )}
          <span>深度思考模式 (Agentic RAG)</span>
        </div>
        <div className="text-xs text-base-content/50 font-mono">
           {event?.step_type === "planning" && "规划中..."}
           {event?.step_type === "executing" && "执行检索..."}
           {event?.step_type === "thinking" && "思考调整..."}
           {event?.step_type === "finished" && "完成"}
        </div>
      </div>

      <div ref={containerRef} className="p-4 max-h-[300px] overflow-y-auto space-y-4">
        
        {/* 已完成的任务历史 */}
        {event?.completed_log.map((log, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center gap-2 text-success text-sm font-medium">
              <CheckCircle2 size={16} className="shrink-0" />
              <span className="line-through opacity-60">{log.task}</span>
            </div>
            {log.thought && (
              <div className="ml-6 text-xs text-base-content/60 bg-base-200/50 p-2 rounded border-l-2 border-success/30">
                <span className="font-bold opacity-80">思考:</span> {log.thought}
              </div>
            )}
          </motion.div>
        ))}

        {/* 当前正在进行的任务 */}
        {event?.current_task && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="flex flex-col gap-2 bg-primary/5 p-3 rounded-lg border border-primary/20"
           >
             <div className="flex items-center gap-2 text-primary font-bold text-sm">
               <Loader2 className="animate-spin" size={16} />
               正在执行: {event.current_task}
             </div>
             {event.thought && (
               <div className="text-xs text-base-content/70 pl-6 animate-pulse">
                 {event.thought}
               </div>
             )}
           </motion.div>
        )}

        {/* 剩余待办清单 */}
        {event?.todo_list && event.todo_list.length > 0 && (
          <div className="pt-2 opacity-60">
            <div className="flex items-center gap-2 text-xs font-bold text-base-content/50 mb-2 uppercase tracking-wider">
              <ListTodo size={12} /> 待执行计划
            </div>
            <div className="space-y-2 pl-1">
              {event.todo_list.map((task, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-base-content/70">
                  <CircleDashed size={14} className="shrink-0" />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {event?.step_type === "finished" && (
           <div className="flex items-center justify-center gap-2 text-sm text-success font-bold py-2">
             <CheckCircle2 size={16} /> 所有步骤执行完毕，正在生成回答...
           </div>
        )}
      </div>
    </motion.div>
  );
};