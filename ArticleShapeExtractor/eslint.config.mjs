import js from "@eslint/js";
import globals from "globals";

export default [

  // Skip 3rd party files.
  {
    ignores: [
      "extensions/lodash.min.js",
    ],
  },

  // Base rules for all modules.
  {
    files: ["**/*.{js,cjs,idjs,mjs}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
    },
  },

  // CommonJS modules.
  {
    files: ["**/*.{js,cjs,idjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node, // includes require/module/exports/process/etc
        app: "readonly",
        Document: "readonly",
        File: "readonly",
        Folder: "readonly",
        alert: "readonly",
        window: "readonly",
        await: "readonly",
      },
    },
  },

  // Node ESM (only used for dev/tooling)
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];
