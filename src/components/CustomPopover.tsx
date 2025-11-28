// frontend/src/components/CustomPopover.tsx

import React from "react";
import { motion } from "framer-motion";

interface CustomPopoverProps {
  content: string;
  top: number;
  left: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const CustomPopover: React.FC<CustomPopoverProps> = ({
  content,
  top,
  left,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <motion.div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={
        {
          top: `${top}px`,
          left: `${left}px`,
        } as any
      }
      className="absolute z-100 card card-compact w-96 max-h-80 overflow-y-auto bg-base-100/95 backdrop-blur shadow-2xl border border-base-200 border-t-4 border-t-primary"
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="card-body p-4">
        <div className="text-xs font-bold text-primary/80 uppercase tracking-wider mb-1 select-none">
          引用条文
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-base-content text-justify">
          {content}
        </div>
      </div>
    </motion.div>
  );
};
