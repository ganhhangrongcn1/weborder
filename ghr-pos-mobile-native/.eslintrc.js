module.exports = {
  root: true,
  extends: '@react-native',
  env: {
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    }
  },
  globals: {
    __dirname: 'readonly',
    Intl: 'readonly',
    module: 'readonly',
    require: 'readonly'
  },
  overrides: [
    { files: ['__tests__/**/*.js'], env: { jest: true } },
  ],
  rules: {
    'no-unused-vars': 'off'
  },
};
