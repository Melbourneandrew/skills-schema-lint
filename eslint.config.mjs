import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { files: ["**/*.mjs"], rules: { "no-unused-vars": "error" } },
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  {
    files: ["**/*.{ts,mjs}"],
    rules: {
      complexity: ["error", { max: 10 }],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: false, skipComments: false },
      ],
      "max-depth": ["error", 4],
    },
  },
  {
    files: ["src/**/*.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
