import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "./base.mjs";

export const nextConfig = [
  ...baseConfig,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules
    },
    settings: {
      next: {
        rootDir: "apps/web/"
      }
    }
  }
];
