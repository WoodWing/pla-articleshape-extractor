import js from "@eslint/js";
import globals from "globals";
import stylistic from "@stylistic/eslint-plugin";

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
        plugins: { stylistic }, // code formatter
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: "latest",
        },
        rules: {
            // formatting rules (ALL autofixable)
            "stylistic/brace-style": ["error", "stroustrup"],
            "stylistic/curly-newline": ["error", "always"],
            "stylistic/comma-dangle": ["error", "always-multiline"],
            "stylistic/comma-spacing": ["error", { "before": false, "after": true }],
            "stylistic/eol-last": ["error", "always"],
            "stylistic/indent": ["error", 4],
            "stylistic/key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
            "stylistic/keyword-spacing": ["error", { "before": true, "after": true }],
            "stylistic/no-mixed-spaces-and-tabs": ["error", true],
            "stylistic/no-tabs": ["error", {}],
            "stylistic/no-trailing-spaces": "error",
            "stylistic/object-curly-spacing": ["error", "always"],
            "stylistic/quotes": ["error", "double"],
            "stylistic/semi": ["error", "always"],
            "stylistic/space-before-blocks": ["error", "always"],
            "stylistic/space-before-function-paren": ["error", "always"],
            "stylistic/space-in-parens": ["error", "never"],
            "stylistic/space-infix-ops": "error",
            // L> Documentation: https://eslint.style/rules
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
                _: "readonly", // set globally by the lodash.min.js extension
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
