import path from "node:path";

const defaultMaxUploadMb = 50;
const defaultAppDataDir = path.join(".data", "PaperTrail");
const defaultStorageDriver = "local";

export type StorageConfig = {
  driver: "local";
  localStorageDir: string;
  maxUploadBytes: number;
  maxUploadMb: number;
};

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

export function getStorageConfig(env: Record<string, string | undefined> = process.env): StorageConfig {
  const driver = env.STORAGE_DRIVER?.trim() || defaultStorageDriver;

  if (driver !== defaultStorageDriver) {
    throw new StorageConfigurationError(`Unsupported STORAGE_DRIVER: ${driver}.`);
  }

  const maxUploadMb = parsePositiveInteger(env.MAX_UPLOAD_MB, defaultMaxUploadMb);
  const localStorageDir = env.PAPERTRAIL_APP_DATA_DIR?.trim() || env.LOCAL_STORAGE_DIR?.trim() || defaultAppDataDir;

  return {
    driver: defaultStorageDriver,
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
