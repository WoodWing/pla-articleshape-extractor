import js from "@eslint/js";
import globals from "globals";
import stylistic from "@stylistic/eslint-plugin";

export default [

    // Skip 3rd party files.
    {
        ignores: [
            "extensions/lodash.min.js"
        ]
    },

    // Base rules for all modules.
    {
        files: ["**/*.{js,cjs,idjs,mjs}"],
        plugins: { stylistic }, // code formatter
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: "latest"
        },
        rules: {
            // formatting rules (ALL autofixable)
            "stylistic/indent": ["error", 4],
            "stylistic/semi": ["error", "always"],
            "stylistic/quotes": ["error", "double"],
            "stylistic/comma-dangle": ["error", "never"],
            "stylistic/object-curly-spacing": ["error", "always"],
            "stylistic/no-trailing-spaces": "error",
            "stylistic/eol-last": ["error", "always"],
            "stylistic/space-before-blocks": ["error", "always"]
        }
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
                _: "readonly" // set globally by the lodash.min.js extension
            }
        }
    },

    // Node ESM (only used for dev/tooling)
    {
        files: ["**/*.mjs"],
        languageOptions: {
            sourceType: "module",
            globals: globals.node
        }
    }
];
