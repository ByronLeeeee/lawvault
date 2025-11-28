// frontend/src/components/ConfirmModal.tsx
import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "确定",
  cancelText = "取消",
  type = "danger",
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-60">
      {" "}
      {/* z-index 要比 Sidebar 高 */}
      <div className="modal-backdrop" onClick={onCancel}></div>
      <div className="modal-box max-w-sm bg-base-100 shadow-2xl border border-base-200 p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div
            className={`p-3 rounded-full ${
              type === "danger"
                ? "bg-error/10 text-error"
                : "bg-warning/10 text-warning"
            }`}
          >
            <AlertTriangle size={32} />
          </div>

          <div>
            <h3 className="font-bold text-lg text-base-content">{title}</h3>
            <p className="py-2 text-sm text-base-content/70">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-center w-full">
          <button className="btn btn-sm flex-1" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn btn-sm flex-1 ${
              type === "danger" ? "btn-error text-white" : "btn-primary"
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
