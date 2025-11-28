// frontend/src/components/StatusBar.tsx
import React, { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface StatusBarProps {
  searchTime: number | null;
  resultsCount: number;
  isLoading: boolean;
}

type Theme = "light" | "dark" | "system";

export const StatusBar: React.FC<StatusBarProps> = ({
  searchTime,
  resultsCount,
  isLoading,
}) => {
  const [theme, setTheme] = useLocalStorage<Theme>("app-theme", "system");

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (targetTheme: string) => {
      root.setAttribute("data-theme", targetTheme);
    };

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      applyTheme(systemTheme);

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) =>
        applyTheme(e.matches ? "dark" : "light");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun size={14} />;
      case "dark":
        return <Moon size={14} />;
      case "system":
        return <Monitor size={14} />;
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-base-200 border-t border-base-300 px-4 py-2 text-xs text-base-content/60 flex justify-between items-center z-30 select-none">
      <div className="flex items-center">
        {isLoading ? (
          <span className="flex items-center gap-2 text-primary">
            <span className="loading loading-spinner loading-xs"></span>
            正在搜索...
          </span>
        ) : (
          <span>
            {searchTime !== null
              ? `找到 ${resultsCount} 条结果，耗时 ${(
                  searchTime * 1000
                ).toFixed(0)} ms`
              : "准备就绪"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 opacity-70">
          <span>快速搜索</span>
          <kbd className="kbd kbd-xs font-sans bg-base-100 border-base-300">
            Ctrl
          </kbd>
          <span>+</span>
          <kbd className="kbd kbd-xs font-sans bg-base-100 border-base-300">
            K
          </kbd>
        </div>

        <div className="dropdown dropdown-top dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-xs btn-ghost gap-2 px-2 font-normal text-base-content/70 hover:bg-base-300"
          >
            {getThemeIcon()}
            <span className="hidden sm:inline capitalize">
              {theme === "system"
                ? "自动"
                : theme === "light"
                ? "亮色"
                : "暗色"}
            </span>
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content z-1 menu p-1 shadow-lg bg-base-100 rounded-box w-32 mb-2 border border-base-200"
          >
            <li>
              <button
                onClick={() => setTheme("light")}
                className={`btn-sm ${theme === "light" ? "active" : ""}`}
              >
                <Sun size={14} /> 亮色模式
              </button>
            </li>
            <li>
              <button
                onClick={() => setTheme("dark")}
                className={`btn-sm ${theme === "dark" ? "active" : ""}`}
              >
                <Moon size={14} /> 暗色模式
              </button>
            </li>
            <li>
              <button
                onClick={() => setTheme("system")}
                className={`btn-sm ${theme === "system" ? "active" : ""}`}
              >
                <Monitor size={14} /> 跟随系统
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};
