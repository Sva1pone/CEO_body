import react from "eslint-plugin-react";


export default [
  {
    files: ["frontend/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        Blob: "readonly",
        clearTimeout: "readonly",
        confirm: "readonly",
        crypto: "readonly",
        document: "readonly",
        fetch: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        Image: "readonly",
        location: "readonly",
        navigator: "readonly",
        scrollTo: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        window: "readonly",
      },
    },
    plugins: { react },
    rules: {
      "no-undef": "error",
      "react/jsx-no-undef": "error",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];
