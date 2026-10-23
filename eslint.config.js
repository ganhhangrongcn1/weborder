import react from "eslint-plugin-react";

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
    plugins: { react },
    rules: {
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
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
    files: ["src/**/*.{js,jsx}", "scripts/**/*.{js,mjs,cjs}", "attendance-miniapp/src/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        // Standard Web APIs used by the browser app and Node's fetch implementation.
        AbortSignal: "readonly",
        Blob: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        TextEncoder: "readonly",
        btoa: "readonly",
        getComputedStyle: "readonly"
      }
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
    files: [
      "ghr-pos-mobile-native/*.config.js",
      "ghr-pos-mobile-native/.eslintrc.js",
      "ghr-pos-mobile-native/.prettierrc.js"
    ],
    languageOptions: {
      sourceType: "commonjs",
      globals: { __dirname: "readonly" }
    }
  },
  {
    // Metro supports static require() for bundled assets in React Native.
    files: ["ghr-pos-mobile-native/src/**/*.js"],
    languageOptions: { globals: { require: "readonly" } }
  },
  {
    files: ["ghr-pos-mobile-native/__tests__/**/*.js"],
    languageOptions: {
      globals: {
        test: "readonly",
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly"
      }
    }
  }
];
