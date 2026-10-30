import { browserStorage, createMockServices, memoryStorage } from "./mock";
import type { Services } from "./types";

export type { Services } from "./types";
export { ServiceError } from "./types";

let instance: Services | null = null;

/**
 * The one place the app obtains its backend. Replace the mock with a real
 * implementation of `Services` here and no UI code needs to change.
 */
export function getServices(): Services {
  if (!instance) {
    const inBrowser = typeof window !== "undefined";
    instance = createMockServices({
      storage: inBrowser ? browserStorage() : memoryStorage(),
      seed: true,
      latencyMs: inBrowser ? 120 : 0,
    });
  }
  return instance;
}
