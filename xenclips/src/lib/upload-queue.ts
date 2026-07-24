import { usePublishStore, type UploadQueueItem } from "./publish-store";

// Mock implementation of actual upload
// In a real scenario, this would use the user-provided OAuth secrets
// from usePublishStore.getState().secrets to authenticate and upload.
async function performMockUpload(
  item: UploadQueueItem,
  onProgress: (progress: number) => void,
  checkCancel: () => boolean,
): Promise<string> {
  const secrets = usePublishStore.getState().secrets;

  if (item.platform === "youtube" && (!secrets.youtubeClientId || !secrets.youtubeClientSecret)) {
    throw new Error("YouTube API credentials missing. Please configure them in Accounts.");
  }

  if (
    item.platform === "instagram" &&
    (!secrets.instagramClientId || !secrets.instagramClientSecret)
  ) {
    throw new Error("Instagram API credentials missing. Please configure them in Accounts.");
  }

  const totalSize = 100;
  let current = 0;

  while (current < totalSize) {
    if (checkCancel()) {
      throw new Error("Upload Cancelled or Paused");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    current += Math.random() * 15;
    if (current > totalSize) current = totalSize;
    onProgress(current);
  }

  // return a mock URL
  return `https://${item.platform}.com/watch?v=${Math.random().toString(36).substring(7)}`;
}

class UploadQueueManager {
  private activeUploads: Map<string, { cancel: () => void }> = new Map();
  private maxConcurrent = 2;
  private isProcessing = false;

  constructor() {
    // Subscribe to store changes to trigger queue processing
    usePublishStore.subscribe((state, prevState) => {
      if (state.queue !== prevState.queue) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const state = usePublishStore.getState();
      const activeCount = state.queue.filter((q) => q.status === "uploading").length;

      if (activeCount >= this.maxConcurrent) {
        this.isProcessing = false;
        return;
      }

      const nextItem = state.queue.find((q) => q.status === "queued");
      if (!nextItem) {
        this.isProcessing = false;
        return;
      }

      // Start upload
      this.startUpload(nextItem.id);

      // Continue processing if there's more capacity
      if (activeCount + 1 < this.maxConcurrent) {
        setTimeout(() => this.processQueue(), 100);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async startUpload(id: string) {
    const store = usePublishStore.getState();
    const item = store.queue.find((q) => q.id === id);
    if (!item) return;

    store.updateQueueItem(id, { status: "uploading", startedAt: Date.now() });

    let isCancelled = false;
    this.activeUploads.set(id, {
      cancel: () => {
        isCancelled = true;
      },
    });

    try {
      const url = await performMockUpload(
        item,
        (progress) => {
          if (!isCancelled) {
            usePublishStore.getState().updateQueueItem(id, { progress });
          }
        },
        () => isCancelled,
      );

      if (!isCancelled) {
        usePublishStore.getState().updateQueueItem(id, {
          status: "completed",
          progress: 100,
          completedAt: Date.now(),
        });

        // Add to history
        usePublishStore.getState().addHistoryItem({
          clipId: item.clipId,
          platform: item.platform,
          title: item.metadata.title || "Untitled Clip",
          status: "success",
          url,
        });

        // Optionally remove from queue after completion
        // setTimeout(() => usePublishStore.getState().removeFromQueue(id), 5000);
      }
    } catch (error: any) {
      if (!isCancelled) {
        usePublishStore.getState().updateQueueItem(id, {
          status: "failed",
          error: error.message,
        });

        usePublishStore.getState().addHistoryItem({
          clipId: item.clipId,
          platform: item.platform,
          title: item.metadata.title || "Untitled Clip",
          status: "failed",
          error: error.message,
        });
      }
    } finally {
      this.activeUploads.delete(id);
      this.processQueue();
    }
  }

  public pause(id: string) {
    const active = this.activeUploads.get(id);
    if (active) {
      active.cancel();
      this.activeUploads.delete(id);
    }
    usePublishStore.getState().updateQueueItem(id, { status: "paused" });
  }

  public resume(id: string) {
    usePublishStore.getState().updateQueueItem(id, { status: "queued" });
  }

  public cancel(id: string) {
    const active = this.activeUploads.get(id);
    if (active) {
      active.cancel();
      this.activeUploads.delete(id);
    }
    usePublishStore.getState().removeFromQueue(id);
  }

  public retry(id: string) {
    usePublishStore.getState().updateQueueItem(id, {
      status: "queued",
      error: undefined,
      progress: 0,
    });
  }
}

export const uploadQueue = new UploadQueueManager();
