import { useState, useEffect, useCallback } from "react";
import { 
  UserFavorite, UserFolder, LawChunk,
  getFavorites, getFolders, addFavorite, removeFavorite, createFolder, deleteFolder, moveFavorite
} from "../services/api";
import { toast } from "react-hot-toast";

export function useFavorites() {
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 统一刷新数据
  const refresh = useCallback(async () => {
    try {
      const [favData, folderData] = await Promise.all([
        getFavorites(),
        getFolders()
      ]);
      setFavorites(favData);
      setFolders(folderData);
    } catch (e) {
      console.error("Failed to fetch user data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Folder 操作
  const addFolder = async (name: string) => {
    if (!name.trim()) return;
    await createFolder(name);
    await refresh();
  };

  const removeFolder = async (id: number) => {
    await deleteFolder(id);
    await refresh();
  };

  // Item 操作
  const add = async (item: LawChunk, folderId?: number) => {
    try {
      await addFavorite(item, folderId); // 默认加入未分类或指定文件夹
      toast.success("已收藏");
      await refresh();
    } catch (e) {
      toast.error("收藏失败");
    }
  };

  const move = async (lawId: string, folderId: number | null) => {
    await moveFavorite(lawId, folderId);
    await refresh();
  };

  const remove = async (lawId: string) => {
    await removeFavorite(lawId);
    await refresh();
  };

  const isFavorite = (lawId: string) => {
    return favorites.some((f) => f.law_id === lawId);
  };

  return { 
    favorites, folders, isLoading, 
    add, remove, move, isFavorite, refresh,
    addFolder, removeFolder 
  };
}