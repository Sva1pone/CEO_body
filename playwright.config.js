import { defineConfig } from "@playwright/test";


export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "chrome",
    headless: true,
  },
  webServer: [
    {
      command: ".venv\\Scripts\\python.exe tests\\e2e\\test_server.py --port 5051",
      url: "http://127.0.0.1:5051",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "set VITE_API_PROXY_TARGET=http://127.0.0.1:5051&& npm run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
