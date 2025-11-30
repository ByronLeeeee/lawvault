import { useState, useEffect, useCallback } from "react";
import { getHistory, addHistory, clearHistory } from "../services/api";

export function useHistory() {
  const [history, setHistory] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await getHistory();
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (query: string) => {
    if (!query.trim()) return;
    await addHistory(query);
    refresh(); 
  };

  const clear = async () => {
    await clearHistory();
    setHistory([]);
  };

  return { history, add, clear, refresh };
}