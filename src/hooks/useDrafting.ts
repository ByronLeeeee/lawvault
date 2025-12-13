// src/hooks/useDrafting.ts

import { useState, useEffect, useCallback } from "react";
import {
  DraftMaterial, CustomTemplate, LawChunk,
  getDraftMaterials, addDraftMaterial, removeDraftMaterial, clearDraftMaterials,
  getTemplates, addTemplate, deleteTemplate
} from "../services/api";
import { toast } from "react-hot-toast";

// 定义自定义事件名称
const EVENT_DRAFT_UPDATE = "lawvault:draft-update";

export function useDrafting() {
  const [materials, setMaterials] = useState<DraftMaterial[]>([]);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 刷新数据的方法
  const refresh = useCallback(async () => {
    try {
      const [mat, temp] = await Promise.all([getDraftMaterials(), getTemplates()]);
      setMaterials(mat);
      setTemplates(temp);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. 初始化加载
  // 2. 监听全局更新事件
  useEffect(() => {
    refresh();

    const handleUpdate = () => {
        refresh();
    };

    window.addEventListener(EVENT_DRAFT_UPDATE, handleUpdate);
    return () => {
        window.removeEventListener(EVENT_DRAFT_UPDATE, handleUpdate);
    };
  }, [refresh]);

  // 辅助函数：触发全局更新
  const notifyUpdate = () => {
      window.dispatchEvent(new Event(EVENT_DRAFT_UPDATE));
  };

  // --- 素材操作 ---
  const addMaterial = async (chunk: LawChunk) => {
    try {
      await addDraftMaterial(chunk);
      toast.success("已加入写作素材库");
      notifyUpdate(); // 通知其他组件刷新
    } catch (e) {
      toast.error("添加失败");
    }
  };

  const removeMaterial = async (lawId: string) => {
    await removeDraftMaterial(lawId);
    notifyUpdate();
  };

  const clearMaterials = async () => {
    await clearDraftMaterials();
    notifyUpdate();
  };

  // --- 模版操作 ---
  const saveTemplate = async (name: string, content: string) => {
    await addTemplate(name, content);
    notifyUpdate();
  };

  const removeTemplate = async (id: number) => {
    await deleteTemplate(id);
    notifyUpdate();
  };

  return {
    materials, templates, isLoading,
    addMaterial, removeMaterial, clearMaterials,
    saveTemplate, removeTemplate,
    refresh
  };
}