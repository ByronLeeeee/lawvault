import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import appIcon from "../assets/icon.png";
export const TitleBar = () => {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-base-100 flex justify-between items-center select-none fixed top-0 left-0 right-0 z-100 border-b border-base-200/50"
      style={{ cursor: "default" }}
    >
      <div className="flex items-center gap-2 pl-4 pointer-events-none">
        <img
          src={appIcon}
          alt="Logo"
          className="w-6 h-6 object-contain drop-shadow-sm"
        />
        <span className="text-sm font-bold text-base-content/80 tracking-wide">
          LawVault - 智能法条库
        </span>
      </div>

      <div className="flex h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="inline-flex justify-center items-center w-12 h-full hover:bg-base-200 text-base-content/70 transition-colors focus:outline-none"
          tabIndex={-1}
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="inline-flex justify-center items-center w-12 h-full hover:bg-base-200 text-base-content/70 transition-colors focus:outline-none"
          tabIndex={-1}
        >
          <Square size={16} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="inline-flex justify-center items-center w-12 h-full hover:bg-error hover:text-white text-base-content/70 transition-colors focus:outline-none"
          tabIndex={-1}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
