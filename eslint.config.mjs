import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare Workers(OpenNext)のビルド成果物と、wrangler types が作る型
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
  ]),
  {
    rules: {
      // 先頭が _ の名前と、残りを取り出すための分割代入(const { a: _a, ...rest })は、使わなくてよい
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
]);

export default eslintConfig;
