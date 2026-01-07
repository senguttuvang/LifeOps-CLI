// @ts-check
import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import importX from "eslint-plugin-import-x";
import promise from "eslint-plugin-promise";
import regexp from "eslint-plugin-regexp";
import n from "eslint-plugin-n";
import effectPlugin from "@effect/eslint-plugin";

/**
 * LifeOps CLI ESLint Configuration
 *
 * Enterprise-grade, strictest quality settings for Effect-TS/TypeScript
 *
 * Plugin Suite:
 * - @effect/eslint-plugin: Effect-TS specific rules
 * - @typescript-eslint: TypeScript-specific rules
 * - sonarjs: Cognitive complexity, code smells (v3.x with S-codes)
 * - unicorn: Modern JavaScript best practices
 * - import-x: Import/export hygiene
 * - promise: Async/await best practices
 * - regexp: Regular expression safety
 * - n: Node.js specific rules
 */
export default [
  // ============================================
  // Base JavaScript Configuration
  // ============================================
  eslint.configs.recommended,

  // ============================================
  // SonarJS Recommended (v3.x uses S-codes)
  // ============================================
  sonarjs.configs.recommended,

  // ============================================
  // TypeScript + Effect-TS Configuration (Strict)
  // ============================================
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2024,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "@effect": effectPlugin,
    },
    rules: {
      // Disable base rules that TypeScript handles
      "no-unused-vars": "off",
      "no-undef": "off",

      // ============================================
      // Effect-TS Specific Rules
      // ============================================
      "@effect/dprint-formatting": "off", // We use Biome for formatting

      // ============================================
      // TypeScript Strict Rules
      // ============================================
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/strict-boolean-expressions": [
        "warn",
        {
          allowString: true,
          allowNumber: true,
          allowNullableObject: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "interface", format: ["PascalCase"] },
        { selector: "typeAlias", format: ["PascalCase"] },
        { selector: "enum", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE"] },
      ],
    },
  },

  // ============================================
  // SonarJS - Override for Stricter Thresholds
  // ============================================
  {
    files: ["src/**/*.ts"],
    rules: {
      // Cognitive Complexity - strict threshold
      "sonarjs/cognitive-complexity": ["error", 15],

      // Duplicate string threshold
      "sonarjs/no-duplicate-string": ["error", { threshold: 3 }],

      // Cyclomatic complexity
      "sonarjs/cyclomatic-complexity": ["error", { threshold: 10 }],
    },
  },

  // ============================================
  // Unicorn - Modern JavaScript Best Practices
  // ============================================
  {
    files: ["src/**/*.ts"],
    plugins: {
      unicorn,
    },
    rules: {
      // File naming
      "unicorn/filename-case": ["error", { case: "kebabCase" }],

      // Modern APIs
      "unicorn/prefer-node-protocol": "error",
      "unicorn/prefer-module": "error",
      "unicorn/prefer-top-level-await": "error",

      // Array methods
      "unicorn/prefer-array-find": "error",
      "unicorn/prefer-array-flat": "error",
      "unicorn/prefer-array-flat-map": "error",
      "unicorn/prefer-array-index-of": "error",
      "unicorn/prefer-array-some": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/no-array-reduce": "warn",

      // String methods
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/prefer-string-starts-ends-with": "error",
      "unicorn/prefer-string-trim-start-end": "error",

      // Other modern features
      "unicorn/prefer-spread": "error",
      "unicorn/prefer-ternary": "warn",
      "unicorn/prefer-default-parameters": "error",
      "unicorn/prefer-optional-catch-binding": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/no-null": "warn",
      "unicorn/throw-new-error": "error",
      "unicorn/error-message": "error",
      "unicorn/custom-error-definition": "error",
      "unicorn/no-abusive-eslint-disable": "error",
      "unicorn/no-process-exit": "error",
      "unicorn/no-new-buffer": "error",

      // Disabled - too strict for Effect-TS patterns
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-static-only-class": "off",
    },
  },

  // ============================================
  // Import-X - Import/Export Hygiene
  // ============================================
  {
    files: ["src/**/*.ts"],
    plugins: {
      "import-x": importX,
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
        node: true,
      },
    },
    rules: {
      // Order and organization
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/no-duplicates": "error",

      // Prevent issues
      "import-x/no-cycle": ["error", { maxDepth: 5 }],
      "import-x/no-self-import": "error",
      "import-x/no-useless-path-segments": "error",
      "import-x/no-mutable-exports": "error",

      // Best practices
      "import-x/no-default-export": "off",
      "import-x/prefer-default-export": "off",
    },
  },

  // ============================================
  // Promise - Async Best Practices
  // ============================================
  {
    files: ["src/**/*.ts"],
    plugins: {
      promise,
    },
    rules: {
      "promise/always-return": "error",
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/catch-or-return": "error",
      "promise/no-native": "off",
      "promise/no-nesting": "warn",
      "promise/no-promise-in-callback": "warn",
      "promise/no-callback-in-promise": "warn",
      "promise/no-new-statics": "error",
      "promise/no-return-in-finally": "error",
      "promise/valid-params": "error",
      "promise/prefer-await-to-then": "error",
      "promise/prefer-await-to-callbacks": "warn",
    },
  },

  // ============================================
  // Regexp - Regular Expression Safety
  // ============================================
  {
    files: ["src/**/*.ts"],
    plugins: {
      regexp,
    },
    rules: {
      // Prevent ReDoS
      "regexp/no-super-linear-backtracking": "error",
      "regexp/no-misleading-unicode-character": "error",
      "regexp/no-obscure-range": "error",

      // Best practices
      "regexp/prefer-quantifier": "error",
      "regexp/prefer-character-class": "error",
      "regexp/no-useless-flag": "error",
      "regexp/no-useless-lazy": "error",
      "regexp/optimal-quantifier-concatenation": "error",
      "regexp/prefer-d": "error",
      "regexp/prefer-w": "error",
      "regexp/prefer-range": "error",
      "regexp/sort-character-class-elements": "error",
    },
  },

  // ============================================
  // Node.js - Node-specific Rules
  // ============================================
  {
    files: ["src/**/*.ts"],
    plugins: {
      n,
    },
    rules: {
      "n/no-deprecated-api": "error",
      "n/no-process-exit": "error",
      "n/prefer-global/buffer": ["error", "always"],
      "n/prefer-global/console": ["error", "always"],
      "n/prefer-global/process": ["error", "always"],
      "n/prefer-global/url": ["error", "always"],
      "n/prefer-global/url-search-params": ["error", "always"],
      "n/prefer-promises/fs": "error",
      "n/prefer-promises/dns": "error",
    },
  },

  // ============================================
  // General Code Style (Strict)
  // ============================================
  {
    files: ["src/**/*.ts"],
    rules: {
      // Complexity limits
      "max-lines-per-function": [
        "warn",
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      complexity: ["error", 10],

      // Code style
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-with": "error",
      "no-void": "error",
      "no-labels": "error",
      "no-continue": "warn",
      "no-plusplus": ["warn", { allowForLoopAfterthoughts: true }],
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",
      "no-lonely-if": "error",
      "no-else-return": ["error", { allowElseIf: false }],

      // Best practices
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "default-case": "error",
      "default-case-last": "error",
      "dot-notation": "error",
      "guard-for-in": "error",
      "no-caller": "error",
      "no-extend-native": "error",
      "no-extra-bind": "error",
      "no-implicit-coercion": "error",
      "no-iterator": "error",
      "no-lone-blocks": "error",
      "no-multi-str": "error",
      "no-new": "error",
      "no-new-wrappers": "error",
      "no-octal-escape": "error",
      "no-proto": "error",
      "no-return-assign": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unused-expressions": "error",
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "prefer-promise-reject-errors": "error",
      radix: "error",
      yoda: "error",
    },
  },

  // ============================================
  // Test Files - Relaxed Rules (no type-aware rules)
  // ============================================
  {
    files: ["test/**/*.ts", "**/*.spec.ts", "**/*.test.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        // Disable type-aware linting for test files
        project: null,
        ecmaVersion: 2024,
        sourceType: "module",
      },
    },
    rules: {
      // Disable type-aware rules (they require project)
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      // Relax quality rules for tests
      "max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
      "unicorn/no-null": "off",
    },
  },

  // ============================================
  // Ignore Patterns
  // ============================================
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".qlty/**",
      "worktrees/**",
      "*.js",
      "!eslint.config.js",
    ],
  },
];
