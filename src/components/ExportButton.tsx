// frontend/src/components/ExportButton.tsx
import React, { useState } from "react";
import { LawChunk } from "../services/api";
import { Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "react-hot-toast";

interface ExportButtonProps {
  results: LawChunk[];
}

export const ExportButton: React.FC<ExportButtonProps> = ({ results }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    const textContent = results
      .map(
        (r) =>
          `【${r.law_name} - ${r.article_number}】\n类别: ${
            r.category
          }\n发布日期: ${r.publish_date || "N/A"}\n\n${r.content}\n\n`
      )
      .join("----------------------------------------\n\n");

    try {
      const filePath = await save({
        title: "导出搜索结果",
        defaultPath: `法律搜索结果_${
          new Date().toISOString().split("T")[0]
        }.txt`,
        filters: [
          {
            name: "Text File",
            extensions: ["txt"],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, textContent);
        toast.success("导出成功！文件已保存。");
      }
    } catch (error) {
      console.error("导出文件失败:", error);
      toast.error(`导出失败: ${String(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (results.length === 0) return null;

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="btn btn-sm btn-ghost font-normal text-base-content/70 hover:text-primary gap-2 transition-colors"
      title="将当前结果导出为TXT文件"
    >
      {isExporting ? (
        <span className="loading loading-spinner loading-xs"></span>
      ) : (
        <Download size={16} />
      )}
      <span className="hidden sm:inline">导出结果</span>
    </button>
  );
};
