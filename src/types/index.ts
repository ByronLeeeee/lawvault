// src/types/index.ts
import { LawChunk } from "../services/api";

export type TabType = "search" | "law-detail" | "drafting";

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  isActive: boolean;
  data?: {
    law?: LawChunk;
  };
}
