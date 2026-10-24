export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "attendance-miniapp/dist/**",
      "attendance-miniapp/.tools/**",
      "attendance-miniapp/tmp/**"
    ]
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        alert: "readonly",
        fetch: "readonly",
        FileReader: "readonly",
        File: "readonly",
        Image: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        CustomEvent: "readonly",
        PopStateEvent: "readonly",
        crypto: "readonly",
        queueMicrotask: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "no-redeclare": "error"
    }
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}", "attendance-miniapp/server/**/*.mjs", "attendance-miniapp/tests/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        AbortSignal: "readonly",
        console: "readonly"
      }
    }
  },
  {
    files: ["attendance-miniapp/src/**/*.{js,jsx}"],
    languageOptions: {
      globals: { AbortSignal: "readonly", AbortController: "readonly", Blob: "readonly", Headers: "readonly", Request: "readonly", Response: "readonly", TextEncoder: "readonly", btoa: "readonly", getComputedStyle: "readonly" }
    }
  },
  {
    files: ["src/**/*.jsx", "attendance-miniapp/src/**/*.jsx"],
    rules: {
      "no-unused-vars": "off"
    }
  }
];
