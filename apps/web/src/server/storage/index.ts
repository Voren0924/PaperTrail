import { getStorageConfig } from "./config";
import { LocalStorageAdapter, type StorageAdapter } from "./local-storage";

export function createStorageAdapter(): StorageAdapter {
  const config = getStorageConfig();

  return new LocalStorageAdapter(config.localStorageDir);
}

export type { StorageAdapter };
