import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.API_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Auth setup - runs once, saves session
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    // Unauthenticated tests - no login required
    {
      name: 'logged-out',
      testMatch: /\.logged-out\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Authenticated tests
    {
      name: 'chromium',
      testIgnore: [/global\.setup\.ts/, /\.logged-out\.spec\.ts/],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      testIgnore: [/global\.setup\.ts/, /\.logged-out\.spec\.ts/],
      use: { ...devices['Desktop Firefox'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      testIgnore: [/global\.setup\.ts/, /\.logged-out\.spec\.ts/],
      use: { ...devices['Pixel 5'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'echo "Start your dev server manually"',
    url: process.env.API_URL || 'http://localhost:4000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
