import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const safeStorage = {
  getItem: (name: string) => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(name);
    }
    return null;
  },
  setItem: (name: string, value: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(name);
    }
  },
};

export type Platform = "youtube" | "instagram";
export type UploadStatus = "queued" | "uploading" | "completed" | "failed" | "paused";

export interface AIProviderKey {
  id: string;
  provider: "gemini" | "openrouter";
  key: string;
}

export interface DeveloperSecrets {
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  instagramClientId?: string;
  instagramClientSecret?: string;
}

export interface Account {
  id: string;
  platform: Platform;
  username: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  isDefault: boolean;
}

export interface UploadQueueItem {
  id: string;
  clipId: string;
  platform: Platform;
  accountId: string;
  status: UploadStatus;
  progress: number;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  metadata: {
    title?: string;
    caption?: string;
    hashtags?: string[];
  };
}

export interface PublishHistoryItem {
  id: string;
  clipId: string;
  platform: Platform;
  title: string;
  date: number;
  status: "success" | "failed";
  url?: string;
  error?: string;
}

interface PublishState {
  aiKeys: AIProviderKey[];
  secrets: DeveloperSecrets;
  accounts: Account[];
  queue: UploadQueueItem[];
  history: PublishHistoryItem[];

  // AI Keys
  addAIKey: (key: Omit<AIProviderKey, "id">) => void;
  removeAIKey: (id: string) => void;
  reorderAIKeys: (newKeys: AIProviderKey[]) => void;

  // Secrets
  updateSecrets: (secrets: Partial<DeveloperSecrets>) => void;

  // Accounts
  addAccount: (account: Omit<Account, "id">) => void;
  removeAccount: (id: string) => void;
  setDefaultAccount: (id: string, platform: Platform) => void;

  // Queue
  enqueue: (item: Omit<UploadQueueItem, "id" | "status" | "progress" | "addedAt">) => void;
  updateQueueItem: (id: string, updates: Partial<UploadQueueItem>) => void;
  removeFromQueue: (id: string) => void;

  // History
  addHistoryItem: (item: Omit<PublishHistoryItem, "id" | "date">) => void;
  clearHistory: () => void;
}

export const usePublishStore = create<PublishState>()(
  persist(
    (set) => ({
      aiKeys: [],
      secrets: {},
      accounts: [],
      queue: [],
      history: [],

      addAIKey: (key) =>
        set((state) => ({
          aiKeys: [...state.aiKeys, { ...key, id: generateId() }],
        })),
      removeAIKey: (id) =>
        set((state) => ({
          aiKeys: state.aiKeys.filter((k) => k.id !== id),
        })),
      reorderAIKeys: (newKeys) => set({ aiKeys: newKeys }),

      updateSecrets: (secrets) => set((state) => ({ secrets: { ...state.secrets, ...secrets } })),

      addAccount: (account) =>
        set((state) => {
          // If this is the first account for this platform, make it default
          const isFirst = !state.accounts.some((a) => a.platform === account.platform);
          return {
            accounts: [
              ...state.accounts,
              { ...account, id: generateId(), isDefault: isFirst || account.isDefault },
            ],
          };
        }),
      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        })),
      setDefaultAccount: (id, platform) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.platform === platform ? { ...a, isDefault: a.id === id } : a,
          ),
        })),

      enqueue: (item) =>
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...item,
              id: generateId(),
              status: "queued",
              progress: 0,
              addedAt: Date.now(),
            },
          ],
        })),
      updateQueueItem: (id, updates) =>
        set((state) => ({
          queue: state.queue.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        })),
      removeFromQueue: (id) =>
        set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),

      addHistoryItem: (item) =>
        set((state) => ({
          history: [{ ...item, id: generateId(), date: Date.now() }, ...state.history],
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "xenclips-publish-storage",
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
