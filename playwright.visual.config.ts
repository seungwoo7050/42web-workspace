import { defineConfig, devices } from "@playwright/test";

// 비주얼 회귀 전용 설정이다. tests/fixtures/content로 만든 빌드를 Playwright 공식 Docker 이미지 안에서만 찍는다.
// 직접 부르지 말고 npm run test:visual(로컬 Docker) 또는 test:visual:container(CI)를 쓴다.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "visual.spec.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  // 기준 이미지는 Linux에서만 만든다. 플랫폼을 이름에 넣어 다른 OS에서 실수로 갱신해도 덮어쓰지 않게 한다
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
  workers: 1,
  use: {
    baseURL: "http://localhost:3400",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next start -p 3400",
    url: "http://localhost:3400",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
