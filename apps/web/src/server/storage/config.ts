import path from "node:path";

const defaultMaxUploadMb = 50;
const defaultLocalStorageDir = ".data/uploads";

export type StorageConfig = {
  driver: "local";
  localStorageDir: string;
  maxUploadBytes: number;
  maxUploadMb: number;
};

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const maxUploadMb = parsePositiveInteger(env.MAX_UPLOAD_MB, defaultMaxUploadMb);
  const localStorageDir = env.LOCAL_STORAGE_DIR?.trim() || defaultLocalStorageDir;

  return {
    driver: "local",
    localStorageDir: path.resolve(process.cwd(), localStorageDir),
    maxUploadBytes: maxUploadMb * 1024 * 1024,
    maxUploadMb
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
