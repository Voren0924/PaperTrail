import { describe, expect, it } from "vitest";

import { getStorageConfig, StorageConfigurationError } from "./config";

describe("storage config", () => {
  it("uses local storage defaults and upload limit overrides", () => {
    const config = getStorageConfig({
      PAPERTRAIL_APP_DATA_DIR: ".data/test-papertrail",
      MAX_UPLOAD_MB: "25"
    });

    expect(config.driver).toBe("local");
    expect(config.localStorageDir).toContain(".data");
    expect(config.maxUploadMb).toBe(25);
    expect(config.maxUploadBytes).toBe(25 * 1024 * 1024);
  });

  it("fails clearly for unsupported storage drivers", () => {
    expect(() => getStorageConfig({ STORAGE_DRIVER: "s3" })).toThrow(StorageConfigurationError);
    expect(() => getStorageConfig({ STORAGE_DRIVER: "s3" })).toThrow("Unsupported STORAGE_DRIVER");
  });
});
