import { createApiServices, getApiBaseUrl } from "./api";
import { browserStorage, createMockServices, memoryStorage } from "./mock";
import type { Services } from "./types";

export type { Services } from "./types";
export { ServiceError } from "./types";
export { getApiBaseUrl } from "./api";

let instance: Services | null = null;

function useMockBackend(): boolean {
  return import.meta.env.VITE_USE_MOCK === "true";
}

/**
 * The one place the app obtains its backend. Defaults to the FastAPI HTTP client;
 * set VITE_USE_MOCK=true to use the in-browser mock again.
 */
export function getServices(): Services {
  if (!instance) {
    if (useMockBackend()) {
      const inBrowser = typeof window !== "undefined";
      instance = createMockServices({
        storage: inBrowser ? browserStorage() : memoryStorage(),
        seed: true,
        latencyMs: inBrowser ? 120 : 0,
      });
    } else {
      instance = createApiServices(getApiBaseUrl());
    }
  }
  return instance;
}

/** Reset singleton (tests). */
export function resetServices(): void {
  instance = null;
}
