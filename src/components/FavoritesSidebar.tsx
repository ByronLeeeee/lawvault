import React, { useState, useMemo } from "react";
import {
  X,
  BookOpen,
  Trash2,
  FolderOpen,
  Plus,
  Folder,
  Star,
  MoreVertical,
} from "lucide-react";
import { motion } from "framer-motion";
import { LawChunk, UserFavorite } from "../services/api";
import { useFavorites } from "../hooks/useFavorites";
import { ConfirmModal } from "./ConfirmModal";

interface FavoritesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onViewFullText: (law: LawChunk) => void;
}

const UNCLASSIFIED_ID = -1;

export const FavoritesSidebar: React.FC<FavoritesSidebarProps> = ({
  isOpen,
  onClose,
  onViewFullText,
}) => {
  const { favorites, folders, remove, addFolder, removeFolder, move } =
    useFavorites();

  const [activeFolderId, setActiveFolderId] = useState<number>(UNCLASSIFIED_ID);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    type: "deleteFolder" | "deleteItem" | null;
    targetId: string | number | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
    title: "",
    message: "",
  });

  const convertToChunk = (fav: UserFavorite): LawChunk => ({
    id: fav.law_id,
    law_name: fav.law_name,
    article_number: fav.article_number,
    content: fav.content,
    source_file: `${fav.law_name}.txt`,
    category: "收藏",
    region: "",
    publish_date: "",
    part: "",
    chapter: "",
    _distance: 0,
  });

  const activeFolderName = useMemo(() => {
    if (activeFolderId === UNCLASSIFIED_ID) return "未分类";
    const folder = folders.find((f) => f.id === activeFolderId);
    return folder ? folder.name : "未知文件夹";
  }, [activeFolderId, folders]);

  const currentItems = useMemo(() => {
    if (activeFolderId === UNCLASSIFIED_ID) {
      return favorites.filter((f) => f.folder_id === null);
    }
    return favorites.filter((f) => f.folder_id === activeFolderId);
  }, [activeFolderId, favorites]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      await addFolder(newFolderName);
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  const requestDeleteFolder = (folderId: number, folderName: string) => {
    setConfirmState({
      isOpen: true,
      type: "deleteFolder",
      targetId: folderId,
      title: "删除文件夹",
      message: `确定要删除文件夹 "${folderName}" 吗？\n警告！文件夹内的条目会被全部删除！`,
    });
  };

  const requestDeleteItem = (lawId: string) => {
    setConfirmState({
      isOpen: true,
      type: "deleteItem",
      targetId: lawId,
      title: "移除收藏",
      message: "确定要移除这条收藏吗？",
    });
  };

  const handleConfirm = async () => {
    const { type, targetId } = confirmState;

    if (type === "deleteFolder" && typeof targetId === "number") {
      await removeFolder(targetId);
      if (activeFolderId === targetId) {
        setActiveFolderId(UNCLASSIFIED_ID);
      }
    } else if (type === "deleteItem" && typeof targetId === "string") {
      await remove(targetId);
    }

    setConfirmState({
      isOpen: false,
      type: null,
      targetId: null,
      title: "",
      message: "",
    });
  };

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
          className="fixed top-10 right-0 h-[calc(100vh-2.5rem)] w-full md:w-[800px] max-w-full bg-base-100 shadow-2xl flex flex-col border-l border-base-200"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-base-200 bg-base-100 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-full">
                <Star className="text-yellow-600 fill-yellow-600 h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-base-content">
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

          {/* Body: Two Columns */}
          <div className="flex grow overflow-hidden">
            {/* Left Column: Folders */}
            <nav className="w-1/3 min-w-[200px] bg-base-200/50 p-3 overflow-y-auto border-r border-base-200 flex flex-col">
              {/* Add Folder Input */}
              <div className="mb-4">
                {!isCreatingFolder ? (
                  <button
                    onClick={() => setIsCreatingFolder(true)}
                    className="btn btn-sm btn-outline w-full gap-2 border-dashed border-base-content/20 font-normal hover:bg-base-100"
                  >
                    <Plus size={16} /> 新建文件夹
                  </button>
                ) : (
                  <form
                    onSubmit={handleCreateFolder}
                    className="join w-full shadow-sm"
                  >
                    <input
                      autoFocus
                      type="text"
                      className="input input-sm input-bordered join-item w-full min-w-0"
                      placeholder="名称..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onBlur={() =>
                        !newFolderName && setIsCreatingFolder(false)
                      }
                    />
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary join-item"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                )}
              </div>

              {/* Folder List */}
              <ul className="menu w-full p-0 gap-1 text-sm">
                {/* 1. Unclassified */}
                <li>
                  <a
                    className={`flex justify-between items-center py-2.5 px-3 rounded-lg ${
                      activeFolderId === UNCLASSIFIED_ID
                        ? "active font-bold"
                        : ""
                    }`}
                    onClick={() => setActiveFolderId(UNCLASSIFIED_ID)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderOpen
                        size={16}
                        className={
                          activeFolderId === UNCLASSIFIED_ID
                            ? ""
                            : "text-base-content/50"
                        }
                      />
                      <span>未分类</span>
                    </div>
                    <span className="badge badge-sm badge-ghost">
                      {favorites.filter((f) => f.folder_id === null).length}
                    </span>
                  </a>
                </li>

                <div className="divider my-1 h-px"></div>

                {/* 2. User Folders */}
                {folders.map((folder) => (
                  <li key={folder.id} className="group relative">
                    <a
                      className={`flex justify-between items-center py-2.5 px-3 rounded-lg ${
                        activeFolderId === folder.id ? "active font-bold" : ""
                      }`}
                      onClick={() => setActiveFolderId(folder.id)}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[120px]">
                        <Folder
                          size={16}
                          className={
                            activeFolderId === folder.id
                              ? ""
                              : "text-base-content/50"
                          }
                        />
                        <span className="truncate">{folder.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="badge badge-sm badge-ghost">
                          {
                            favorites.filter((f) => f.folder_id === folder.id)
                              .length
                          }
                        </span>
                        <div
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteFolder(folder.id, folder.name);
                          }}
                          className={`p-1 rounded hover:bg-error hover:text-white transition-colors ${
                            activeFolderId === folder.id
                              ? "text-primary-content/70"
                              : "text-base-content/30 opacity-0 group-hover:opacity-100"
                          }`}
                          title="删除文件夹"
                        >
                          <Trash2 size={14} />
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Right Column: Items */}
            <main className="w-2/3 p-4 md:p-6 overflow-y-auto bg-base-100 relative">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-base-100/95 backdrop-blur z-10 py-2 border-b border-transparent">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  {activeFolderId === UNCLASSIFIED_ID ? (
                    <FolderOpen className="text-base-content/30" />
                  ) : (
                    <Folder className="text-primary" />
                  )}
                  {activeFolderName}
                </h3>
                <span className="text-xs text-base-content/50">
                  {currentItems.length} 条记录
                </span>
              </div>

              {currentItems.length > 0 ? (
                <div className="grid gap-4">
                  {currentItems.map((item) => (
                    <div
                      key={item.id}
                      className="card card-compact card-bordered bg-base-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
                    >
                      <div className="card-body">
                        <div className="flex justify-between items-start gap-3">
                          <div className="grow">
                            <h4 className="font-bold text-base text-base-content mb-1">
                              {item.law_name}{" "}
                              <span className="font-normal text-base-content/70 text-sm ml-1">
                                {item.article_number}
                              </span>
                            </h4>
                            <p className="text-xs text-base-content/60 line-clamp-2 leading-relaxed font-mono">
                              {item.content}
                            </p>
                          </div>

                          {/* Item Actions Dropdown */}
                          <div className="dropdown dropdown-end">
                            <div
                              tabIndex={0}
                              role="button"
                              className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical size={16} />
                            </div>
                            <ul
                              tabIndex={0}
                              className="dropdown-content z-20 menu p-2 shadow-lg bg-base-100 rounded-box w-40 border border-base-200 text-xs"
                            >
                              <li className="menu-title px-2 py-1 text-xs opacity-50">
                                移动到...
                              </li>
                              <li>
                                <a onClick={() => move(item.law_id, null)}>
                                  未分类
                                </a>
                              </li>
                              {folders.map(
                                (f) =>
                                  f.id !== activeFolderId && (
                                    <li key={f.id}>
                                      <a
                                        onClick={() => move(item.law_id, f.id)}
                                      >
                                        {f.name}
                                      </a>
                                    </li>
                                  )
                              )}
                              <div className="divider my-1"></div>
                              <li>
                                <a
                                  className="text-error"
                                  onClick={() => requestDeleteItem(item.law_id)}
                                >
                                  删除
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div className="card-actions justify-end mt-2 pt-2 border-t border-base-100/50">
                          <button
                            onClick={() => {
                              onViewFullText(convertToChunk(item));
                            }}
                            className="btn btn-xs btn-ghost gap-1 text-primary hover:bg-primary/10"
                          >
                            <BookOpen size={14} /> 查看全文
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/30 select-none">
                  <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen size={32} />
                  </div>
                  <p className="text-sm font-medium">空空如也</p>
                  <p className="text-xs mt-1 opacity-70">
                    去搜索法条添加进来吧
                  </p>
                </div>
              )}
            </main>
          </div>
        </motion.div>
      </motion.div>

      {/* 自定义确认弹窗 - 放在最外层 */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="确定删除"
        cancelText="取消"
        type="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
