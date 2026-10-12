import type { CaptureCachePort } from "@screenshotapi/engine";
import type { CaptureStore } from "@screenshotapi/storage";

export function createWorkerCache(store: Pick<CaptureStore, "lookup">): CaptureCachePort {
  return {
    lookup: async (options) => {
      try {
        const cached = await store.lookup(options);
        return cached.hit ? { data: cached.data, buffer: cached.buffer } : null;
      } catch {
        return null;
      }
    },
    save: async (_options, data) => data,
  };
}
