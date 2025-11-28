// frontend/src/components/FavoritesSidebar.tsx
import React, { useState } from "react";
import { FavoriteFolder, LawChunk } from "../services/api";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Folder, Star, Plus, Trash2, X, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { ConfirmModal } from "./ConfirmModal";

interface FavoritesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onViewFullText: (item: LawChunk) => void;
}

export const FavoritesSidebar: React.FC<FavoritesSidebarProps> = ({
  isOpen,
  onClose,
  onViewFullText,
}) => {
  const [folders, setFolders] = useLocalStorage<FavoriteFolder[]>("favorites", [
    { id: "default", name: "默认收藏夹", items: [] },
  ]);
  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string>("default");

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    type: "deleteFolder" | "deleteItem" | null;
    targetId: string | null;
    folderId?: string;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
  });

  const addFolder = () => {
    if (newFolderName.trim()) {
      const newFolder: FavoriteFolder = {
        id: Date.now().toString(),
        name: newFolderName.trim(),
        items: [],
      };
      setFolders([...folders, newFolder]);
      setNewFolderName("");
    }
  };

  const requestDeleteFolder = (folderId: string) => {
    if (folderId === "default") return;
    setConfirmState({
      isOpen: true,
      type: "deleteFolder",
      targetId: folderId,
    });
  };

  const requestDeleteItem = (itemId: string, folderId: string) => {
    setConfirmState({
      isOpen: true,
      type: "deleteItem",
      targetId: itemId,
      folderId: folderId,
    });
  };

  const handleConfirmDelete = () => {
    const { type, targetId, folderId } = confirmState;

    if (type === "deleteFolder" && targetId) {
      setFolders(folders.filter((f) => f.id !== targetId));
      toast.success("文件夹已删除");
      if (activeFolderId === targetId) {
        setActiveFolderId("default");
      }
    } else if (type === "deleteItem" && targetId && folderId) {
      setFolders(
        folders.map((folder) => {
          if (folder.id === folderId) {
            return {
              ...folder,
              items: folder.items.filter((item) => item.id !== targetId),
            };
          }
          return folder;
        })
      );
      toast.success("已移除收藏");
    }

    setConfirmState({ isOpen: false, type: null, targetId: null });
  };

  const activeFolder =
    folders.find((f) => f.id === activeFolderId) || folders[0];

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-base-content/20 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          className="fixed top-10 right-0 h-[calc(100%-2.5rem)] w-full md:w-[800px] max-w-full bg-base-100 shadow-2xl flex flex-col"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <header className="flex items-center justify-between p-5 border-b border-base-200 bg-base-100 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-full">
                <Star className="text-yellow-600 fill-yellow-600 h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-base-content">
                  我的收藏
                </h2>
                <p className="text-xs text-base-content/50">
                  管理您的法律知识库
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-circle btn-ghost btn-sm hover:bg-base-200"
            >
              <X size={22} />
            </button>
          </header>

          <div className="flex grow overflow-hidden">
            <nav className="w-1/3 min-w-[220px] bg-base-200/50 p-3 overflow-y-auto border-r border-base-200 flex flex-col">
              <div className="join w-full mb-4 shadow-sm">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="新建文件夹..."
                  className="input input-sm input-bordered join-item w-full focus:outline-none bg-base-100"
                />
                <button
                  onClick={addFolder}
                  className="btn btn-sm join-item btn-neutral"
                >
                  <Plus size={16} />
                </button>
              </div>

              <ul className="menu w-full p-0 gap-1">
                {folders.map((folder) => (
                  <li key={folder.id} className="group relative">
                    <a
                      className={`flex justify-between items-center py-3 px-4 rounded-lg transition-all ${
                        activeFolderId === folder.id
                          ? "active bg-neutral text-neutral-content shadow-md"
                          : "hover:bg-base-200 bg-transparent"
                      }`}
                      onClick={() => setActiveFolderId(folder.id)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Folder
                          size={18}
                          className={
                            activeFolderId === folder.id
                              ? "fill-neutral-content/20"
                              : "text-base-content/50"
                          }
                        />
                        <span className="truncate font-medium">
                          {folder.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`badge badge-sm border-none ${
                            activeFolderId === folder.id
                              ? "bg-white/20 text-white"
                              : "bg-base-300 text-base-content/70"
                          }`}
                        >
                          {folder.items.length}
                        </span>
                        {folder.id !== "default" && (
                          <div
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteFolder(folder.id);
                            }}
                            className="ml-1 p-1 rounded hover:bg-red-500 hover:text-white text-base-content/40 transition-colors opacity-0 group-hover:opacity-100"
                            title="删除文件夹"
                          >
                            <Trash2 size={14} />
                          </div>
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <main className="w-2/3 p-4 md:p-6 overflow-y-auto bg-base-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <Folder className="text-base-content/30" size={24} />
                  {activeFolder.name}
                </h3>
                <span className="text-xs text-base-content/50">
                  共 {activeFolder.items.length} 条记录
                </span>
              </div>

              {activeFolder.items.length > 0 ? (
                <div className="grid gap-4">
                  {activeFolder.items.map((item) => (
                    <div
                      key={item.id}
                      className="card card-compact card-bordered bg-base-100 shadow-sm hover:shadow-md hover:border-neutral/20 transition-all duration-200 group"
                    >
                      <div className="card-body">
                        <div className="flex justify-between items-start gap-3">
                          <div className="grow">
                            <h4 className="font-bold text-base text-base-content mb-1 flex items-center gap-2">
                              {item.law_name}
                              <span className="badge badge-ghost badge-sm font-normal">
                                {item.article_number}
                              </span>
                            </h4>
                            <p className="text-sm text-base-content/70 line-clamp-2 leading-relaxed">
                              {item.content}
                            </p>
                          </div>
                        </div>
                        <div className="card-actions justify-end mt-2 pt-2 border-t border-base-100 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              onViewFullText(item);
                              onClose();
                            }}
                            className="btn btn-xs btn-ghost gap-1 hover:bg-primary/10 hover:text-primary"
                          >
                            <BookOpen size={14} /> 查看全文
                          </button>
                          <button
                            onClick={() =>
                              requestDeleteItem(item.id, activeFolder.id)
                            }
                            className="btn btn-xs btn-ghost text-error hover:bg-error/10"
                          >
                            <Trash2 size={14} /> 移除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/30">
                  <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center mb-4">
                    <Folder size={40} />
                  </div>
                  <p className="text-lg font-medium">这个文件夹是空的</p>
                  <p className="text-sm mt-1">去搜索一些法律条文添加进来吧</p>
                </div>
              )}
            </main>
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.type === "deleteFolder" ? "删除文件夹" : "移除条文"}
        message={
          confirmState.type === "deleteFolder"
            ? "确定要删除这个文件夹及其所有内容吗？此操作无法撤销。"
            : "确定要从收藏夹中移除此条文吗？"
        }
        confirmText="确定删除"
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setConfirmState({ isOpen: false, type: null, targetId: null })
        }
      />
    </>
  );
};
