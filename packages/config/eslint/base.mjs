import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/.worktrees/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/*.cjs",
      "**/*.config.mjs",
      "**/*.config.ts",
      "**/next-env.d.ts"
    ]
  },
  {
    files: ["**/*.{js,mjs}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"]
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
