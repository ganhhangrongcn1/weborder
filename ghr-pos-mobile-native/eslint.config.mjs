export default [
  {
    ignores: [
      "android/**",
      "ios/**",
      "node_modules/**"
    ]
  },
  {
    files: ["**/*.{js,jsx,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        __dirname: "readonly",
        console: "readonly",
        Intl: "readonly",
        module: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unused-vars": "off"
    }
  }
];
