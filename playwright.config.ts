import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3123);

// Software WebGL so the real 3D scene renders in headless Chromium.
const gl = { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

export default defineConfig({
  testDir: "tests/e2e",
  // Generous limits: CI renders the full-screen WebGL café on a software GPU (SwiftShader).
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: gl,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 }, launchOptions: gl } },
    { name: "ipad", use: { ...devices["iPad Mini"], browserName: "chromium", launchOptions: gl } },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions: gl } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
