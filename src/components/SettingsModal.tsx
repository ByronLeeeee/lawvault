import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  X,
  Save,
  LayoutGrid,
  Bot,
  Database,
  Key,
  Globe,
  Cpu,
  Info,
  Mail,
  Briefcase,
  Copyright,
  Loader2,
  CheckCircle2,
  Settings,
  HardDrive,
  FolderOpen,
} from "lucide-react";
import {
  getSettings,
  saveSettings,
  AppSettings,
  checkAiConnection,
  selectFolder,
} from "../services/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "general" | "embedding" | "chat" | "advanced" | "about";

const SettingInput = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: any) => (
  <div className="form-control">
    <label className="label">
      <span className="label-text font-medium flex items-center gap-2">
        {Icon && <Icon size={14} className="opacity-70" />}
        {label}
      </span>
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input input-bordered input-sm font-mono text-xs"
    />
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<AppSettings>({
    search_top_k: 50,
    display_density: "comfortable",

    embedding_base_url: "http://localhost:11434/v1",
    embedding_api_key: "ollama",
    embedding_model: "embeddinggemma:300m",

    enable_ai_chat: false,
    chat_base_url: "http://localhost:11434/v1",
    chat_api_key: "ollama",
    chat_model: "gemma3",
    chat_top_k: 5,
  });

  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getSettings()
        .then((data) => setConfig((prev) => ({ ...prev, ...data })))
        .catch(() => toast.error("加载设置失败"))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  const handleSave = async () => {
    try {
      if (config.chat_top_k > config.search_top_k) {
        toast.error("AI参考数量不能大于搜索返回总数");
        return;
      }
      await saveSettings(config);
      toast.success("设置已保存");
      onClose();
    } catch {
      toast.error("保存失败");
    }
  };

  const handleTestConnection = async (type: "embedding" | "chat") => {
    setIsTesting(true);
    const baseUrl =
      type === "embedding" ? config.embedding_base_url : config.chat_base_url;
    const apiKey =
      type === "embedding" ? config.embedding_api_key : config.chat_api_key;
    const model =
      type === "embedding" ? config.embedding_model : config.chat_model;

    toast
      .promise(checkAiConnection(baseUrl, apiKey, model), {
        loading: "正在连接服务器...",
        success: (msg) => msg,
        error: (err) => `测试失败: ${err.message}`,
      })
      .finally(() => setIsTesting(false));
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-50">
      <div className="modal-backdrop" onClick={onClose}></div>

      <div className="modal-box w-11/12 max-w-4xl h-[650px] p-0 bg-base-100 shadow-2xl border border-base-200 flex flex-col overflow-hidden rounded-xl">
        <div className="flex justify-between items-center px-6 py-4 border-b border-base-200 bg-base-100 shrink-0">
          <h3 className="font-bold text-xl text-base-content">系统设置</h3>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost hover:bg-base-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex grow overflow-hidden">
          <aside className="w-60 bg-base-200/50 border-r border-base-200 flex flex-col p-3 shrink-0">
            <ul className="menu gap-1 w-full p-0">
              <li>
                <button
                  onClick={() => setActiveTab("general")}
                  className={
                    activeTab === "general"
                      ? "active font-medium"
                      : "font-medium"
                  }
                >
                  <LayoutGrid size={18} />
                  显示与检索
                </button>
              </li>
              <div className="divider my-1 text-xs opacity-50">模型服务</div>
              <li>
                <button
                  onClick={() => setActiveTab("embedding")}
                  className={
                    activeTab === "embedding"
                      ? "active font-medium"
                      : "font-medium"
                  }
                >
                  <Database size={18} />
                  向量模型 (Embedding)
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={
                    activeTab === "chat" ? "active font-medium" : "font-medium"
                  }
                >
                  <Bot size={18} />
                  AI 问答 (Chat)
                </button>
              </li>
              <div className="divider my-1 text-xs opacity-50">高级</div>
              <li>
                <button
                  onClick={() => setActiveTab("advanced")}
                  className={
                    activeTab === "advanced"
                      ? "active font-medium"
                      : "font-medium"
                  }
                >
                  <Settings size={18} />
                  高级设置
                </button>
              </li>
              <div className="divider my-1 text-xs opacity-50">其他</div>
              <li>
                <button
                  onClick={() => setActiveTab("about")}
                  className={
                    activeTab === "about" ? "active font-medium" : "font-medium"
                  }
                >
                  <Info size={18} />
                  关于软件
                </button>
              </li>
            </ul>
          </aside>

          <main className="grow overflow-y-auto p-8 bg-base-100">
            {activeTab === "general" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="font-bold text-lg mb-1">基础设置</h3>
                  <p className="text-xs text-base-content/60">
                    调整界面的显示方式和搜索结果数量。
                  </p>
                </div>

                <fieldset className="fieldset bg-base-200/30 p-4 rounded-box border border-base-200">
                  <legend className="fieldset-legend font-bold">
                    搜索数量 (Top K)
                  </legend>
                  <div className="flex items-center gap-4 mt-2">
                    <input
                      type="range"
                      min="5"
                      step="5"
                      value={config.search_top_k}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          search_top_k: parseInt(e.target.value),
                        })
                      }
                      className="range range-primary range-sm"
                    />
                    <span className="badge badge-lg font-mono">
                      {config.search_top_k}
                    </span>
                  </div>
                </fieldset>

                <fieldset className="fieldset bg-base-200/30 p-4 rounded-box border border-base-200">
                  <legend className="fieldset-legend font-bold">
                    显示密度
                  </legend>
                  <div className="join mt-2">
                    <input
                      className="join-item btn btn-sm"
                      type="radio"
                      name="density"
                      aria-label="舒适"
                      checked={config.display_density === "comfortable"}
                      onChange={() =>
                        setConfig({ ...config, display_density: "comfortable" })
                      }
                    />
                    <input
                      className="join-item btn btn-sm"
                      type="radio"
                      name="density"
                      aria-label="紧凑"
                      checked={config.display_density === "compact"}
                      onChange={() =>
                        setConfig({ ...config, display_density: "compact" })
                      }
                    />
                  </div>
                </fieldset>
              </div>
            )}

            {activeTab === "embedding" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg mb-1">向量模型服务</h3>
                    <p className="text-xs text-base-content/60">
                      用于将搜索词转换为向量。
                    </p>
                  </div>
                  <button
                    onClick={() => handleTestConnection("embedding")}
                    className="btn btn-sm btn-neutral gap-2"
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    测试连接
                  </button>
                </div>

                <div className="bg-base-200/30 p-6 rounded-xl border border-base-200 space-y-4">
                  <SettingInput
                    label="API 地址"
                    icon={Globe}
                    value={config.embedding_base_url}
                    onChange={(v: string) =>
                      setConfig({ ...config, embedding_base_url: v })
                    }
                    placeholder="http://localhost:11434/v1"
                  />
                  <SettingInput
                    label="API 密钥"
                    icon={Key}
                    type="password"
                    value={config.embedding_api_key}
                    onChange={(v: string) =>
                      setConfig({ ...config, embedding_api_key: v })
                    }
                    placeholder="ollama (或 OpenAI Key)"
                  />
                  <SettingInput
                    label="模型名称"
                    icon={Cpu}
                    value={config.embedding_model}
                    onChange={(v: string) =>
                      setConfig({ ...config, embedding_model: v })
                    }
                    placeholder="embeddinggemma:300m"
                  />
                </div>
                <div className="alert alert-warning text-xs">
                  警告：本项目目前基于 embeddinggemma:300m
                  模型制作，如果更换模型可能会导致结果不正确。
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="font-bold text-lg mb-1">AI 问答助手</h3>
                  <p className="text-xs text-base-content/60">
                    用于基于搜索结果回答用户提问 (RAG)。
                  </p>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-4 border border-base-200 p-3 rounded-lg hover:bg-base-200/30">
                    <input
                      type="checkbox"
                      className="toggle toggle-success"
                      checked={config.enable_ai_chat}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          enable_ai_chat: e.target.checked,
                        })
                      }
                    />
                    <span className="font-bold">启用 AI 问答</span>
                  </label>
                </div>

                {config.enable_ai_chat && (
                  <div className="bg-base-200/30 p-6 rounded-xl border border-base-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleTestConnection("chat")}
                        className="btn btn-xs btn-outline gap-1"
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        测试连接
                      </button>
                    </div>
                    <SettingInput
                      label="API 地址"
                      icon={Globe}
                      value={config.chat_base_url}
                      onChange={(v: string) =>
                        setConfig({ ...config, chat_base_url: v })
                      }
                      placeholder="http://localhost:11434/v1"
                    />
                    <SettingInput
                      label="API 密钥"
                      icon={Key}
                      type="password"
                      value={config.chat_api_key}
                      onChange={(v: string) =>
                        setConfig({ ...config, chat_api_key: v })
                      }
                      placeholder="ollama (或 OpenAI Key)"
                    />
                    <SettingInput
                      label="模型名称"
                      icon={Cpu}
                      value={config.chat_model}
                      onChange={(v: string) =>
                        setConfig({ ...config, chat_model: v })
                      }
                      placeholder="qwen3:7b"
                    />

                    <div className="divider"></div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          参考条文数量 ({config.chat_top_k})
                        </span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        step="1"
                        value={config.chat_top_k}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            chat_top_k: parseInt(e.target.value),
                          })
                        }
                        className="range range-success range-xs"
                      />
                      <label className="label">
                        <span className="label-text-alt text-base-content/50">
                          传递给 AI 的上下文数量，过多可能会导致幻觉。
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === "advanced" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="font-bold text-lg mb-1">高级设置</h3>
                  <p className="text-xs text-base-content/60">
                    如无必要，请勿调整。
                  </p>
                </div>

                <fieldset className="fieldset bg-base-200/30 p-4 rounded-box border border-base-200 border-l-4 border-l-secondary">
                  <legend className="fieldset-legend font-bold flex items-center gap-2">
                    <HardDrive size={14} /> 数据库位置 (高级)
                  </legend>

                  <div className="flex flex-col gap-2 mt-1 w-full">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-sm input-bordered flex-1 font-mono text-xs opacity-80"
                        value={config.custom_data_path || ""}
                        placeholder="默认 (程序内部路径)"
                        readOnly
                      />
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={async () => {
                          const path = await selectFolder();
                          if (path) {
                            setConfig({ ...config, custom_data_path: path });
                            toast.success(
                              "路径已选择，请确保该目录下包含 content.db 和 law_db.lancedb"
                            );
                          }
                        }}
                      >
                        <FolderOpen size={16} /> 更改
                      </button>
                      {config.custom_data_path && (
                        <button
                          className="btn btn-sm btn-ghost text-error"
                          onClick={() =>
                            setConfig({ ...config, custom_data_path: "" })
                          }
                          title="恢复默认"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-base-content/50 leading-tight">
                      可以将数据库放在 NAS 或共享文件夹中供团队使用。
                      <br />
                      <span className="text-warning">
                        注意：更改后，请手动将 <b>content.db</b> 和{" "}
                        <b>law_db.lancedb</b>{" "}
                        文件夹移动到新路径下，否则无法搜索。
                      </span>
                    </p>
                  </div>
                </fieldset>
              </div>
            )}

            {activeTab === "about" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-center md:text-left">
                <div className="flex flex-col items-center md:items-start gap-4">
                  <div className="bg-primary/10 p-4 rounded-2xl">
                    <Info size={48} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-base-content">
                      智能法条库
                    </h2>
                    <p className="text-sm text-base-content/60 font-mono mt-1">
                      LawVault v0.2.0
                    </p>
                  </div>
                  <p className="text-base-content/80 leading-relaxed max-w-prose">
                    一款专为法律从业者设计的本地化智能检索工具。
                    <br />
                    基于 Rust
                    和先进的向量检索技术，在保障数据隐私的前提下，实现了极速、精准的语义搜索。
                    配合 AI 辅助分析，让法律条文的查找与理解变得前所未有的简单。
                  </p>
                </div>

                <div className="divider"></div>

                <div className="card bg-base-200/50 border border-base-200">
                  <div className="card-body p-6">
                    <h3 className="card-title text-base mb-4 flex items-center gap-2">
                      <Briefcase size={18} className="text-primary" />{" "}
                      开发者信息
                    </h3>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder"></div>
                        <div>
                          <div className="font-bold">李伯阳 律师</div>
                          <div className="text-xs opacity-60">
                            北京市隆安（广州）律师事务所
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm mt-2 bg-base-100 p-3 rounded-lg border border-base-content/5">
                        <Mail size={16} className="text-primary/70" />
                        <a
                          href="mailto:liboyang@lslby.com"
                          className="link link-hover font-mono"
                        >
                          liboyang@lslby.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-base-content/40 flex items-center justify-center md:justify-start gap-1 mt-8">
                  <Copyright size={12} />
                  <span>2025 LawVault. All rights reserved.</span>
                </div>
              </div>
            )}
          </main>
        </div>

        <div className="p-4 border-t border-base-200 bg-base-100 flex justify-end gap-2 shrink-0">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            取消
          </button>
          <button
            className="btn btn-primary gap-2 px-6"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <Save size={18} />
            )}
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};
