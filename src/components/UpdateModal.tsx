// frontend/src/components/UpdateModal.tsx

import React from "react";
import { ExternalLink, X, Info, Github } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener"; 

export interface GithubUpdate {
  version: string;
  body: string;
  html_url: string;
}

interface UpdateModalProps {
  update: GithubUpdate;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  update,
  onClose,
}) => {
  const formatBody = (body: string) => {
    return body.split("\r\n").map((line, i) => (
      <p key={i} className="mb-1">
        {line}
      </p>
    ));
  };

  const handleGoToDownload = async () => {
    await openUrl(update.html_url);
    onClose();
  };

  return (
    <div className="modal modal-open z-100">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-box bg-base-100 shadow-2xl border border-primary/20">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            发现新版本 {update.version}
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            <X size={20} />
          </button>
        </div>

        <div className="bg-base-200/50 p-4 rounded-lg mb-6 max-h-60 overflow-y-auto text-sm text-base-content/80">
          <div className="flex items-center gap-2 mb-2 text-primary font-bold">
            <Github size={14} /> 更新内容：
          </div>
          <div className="leading-relaxed">
             {update.body ? formatBody(update.body) : "暂无详细日志"}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="alert alert-info text-xs py-2 bg-info/10 text-info-content border-info/20">
             <span>检测到新版本，请前往 GitHub 下载最新版本。</span>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button className="btn btn-ghost" onClick={onClose}>
              暂不更新
            </button>
            <button
              className="btn btn-primary gap-2"
              onClick={handleGoToDownload}
            >
              <ExternalLink size={18} /> 前往下载页面
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};