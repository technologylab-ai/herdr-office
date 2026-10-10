import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (process.platform === 'darwin' && existsSync(macChrome) ? macChrome : undefined);
const testPort = Number(process.env.HERDR_OFFICE_TEST_PORT || 5173);
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests',
  // Software WebGL on shared CI CPUs needs longer than a local GPU renderer.
  timeout: process.env.CI ? 120_000 : 45_000,
  expect: { timeout: process.env.CI ? 30_000 : 12_000 },
  fullyParallel: !!process.env.CI,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `node_modules/.bin/vite --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
