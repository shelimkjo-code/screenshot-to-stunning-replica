import { create } from "zustand";
import { DEFAULT_EDITS, type Edits, type EnhanceMode } from "./imaging";
import { DEFAULT_COPIES, DEFAULT_GAP_MM, DEFAULT_MARGIN_MM, SIZE_PRESETS } from "./layout";

export type Stage = "queued" | "uploading" | "enhancing" | "removing_bg" | "finishing" | "done" | "failed";
export type StepStatus = "pending" | "running" | "done" | "off" | "not_connected" | "failed";
export type BgEngine = "auto" | "removebg" | "local";

export interface PhotoItem {
  id: string;
  fileName: string;
  original: Blob | null;
  work: Blob | null;
  enhanced: Blob | null;
  cutout: Blob | null;
  paths: { original?: string; work?: string; enhanced?: string; cutout?: string };
  stage: Stage;
  progress: number;
  error: string | null;
  enhanceStatus: StepStatus;
  bgStatus: StepStatus;
  bgEngineUsed: "removebg" | "local" | null;
  lowRes: boolean;
  copies: number;
  edits: Edits;
  version: number;
  saved: boolean;
  sortOrder: number;
}

export interface Settings {
  sizePreset: "passport" | "stamp" | "custom";
  widthMm: number;
  heightMm: number;
  marginMm: number;
  gapMm: number;
  bgColor: string;
  enhanceMode: EnhanceMode;
  bgEngine: BgEngine;
  defaultCopies: number;
  autoDelete: boolean;
}

export const BG_PRESETS = {
  blue: "#2f6fc9",
  lightBlue: "#a9cdf2",
  white: "#ffffff",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  sizePreset: "passport",
  widthMm: SIZE_PRESETS.passport.widthMm,
  heightMm: SIZE_PRESETS.passport.heightMm,
  marginMm: DEFAULT_MARGIN_MM,
  gapMm: DEFAULT_GAP_MM,
  bgColor: BG_PRESETS.blue,
  enhanceMode: "natural",
  bgEngine: "auto",
  defaultCopies: DEFAULT_COPIES,
  autoDelete: false,
};

export interface Services {
  removeBg: boolean;
  replicate: boolean;
}

interface StudioState {
  jobId: string | null;
  jobTitle: string;
  photos: PhotoItem[];
  settings: Settings;
  services: Services | null;
  filesDeleted: boolean;
  setServices: (s: Services) => void;
  setJob: (id: string | null, title?: string) => void;
  addPhotos: (items: PhotoItem[]) => void;
  updatePhoto: (id: string, patch: Partial<PhotoItem>) => void;
  removePhoto: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setFilesDeleted: (v: boolean) => void;
  reset: () => void;
  replaceAll: (s: { jobId: string; jobTitle: string; photos: PhotoItem[]; settings: Settings; filesDeleted: boolean }) => void;
}

export const useStudio = create<StudioState>((set) => ({
  jobId: null,
  jobTitle: "",
  photos: [],
  settings: DEFAULT_SETTINGS,
  services: null,
  filesDeleted: false,
  setServices: (services) => set({ services }),
  setJob: (jobId, jobTitle) => set((s) => ({ jobId, jobTitle: jobTitle ?? s.jobTitle })),
  addPhotos: (items) => set((s) => ({ photos: [...s.photos, ...items] })),
  updatePhoto: (id, patch) =>
    set((s) => ({
      photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch, version: p.version + 1 } : p)),
    })),
  removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setFilesDeleted: (filesDeleted) => set({ filesDeleted }),
  reset: () => set((s) => ({ jobId: null, jobTitle: "", photos: [], filesDeleted: false, settings: { ...DEFAULT_SETTINGS, autoDelete: s.settings.autoDelete } })),
  replaceAll: (v) => set(v),
}));

export function newPhotoItem(file: File, copies: number, sortOrder: number): PhotoItem {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    original: file,
    work: null,
    enhanced: null,
    cutout: null,
    paths: {},
    stage: "queued",
    progress: 0,
    error: null,
    enhanceStatus: "pending",
    bgStatus: "pending",
    bgEngineUsed: null,
    lowRes: false,
    copies,
    edits: { ...DEFAULT_EDITS },
    version: 0,
    saved: false,
    sortOrder,
  };
}

export function frameKey(s: Settings) {
  return `${s.widthMm}x${s.heightMm}|${s.bgColor}|${s.enhanceMode}|${s.sizePreset}`;
}
