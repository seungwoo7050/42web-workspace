import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // 단위 테스트는 코드 동작을 검사하므로 사용자가 바꾸는 src/content가 아니라 고정 fixture를 입력으로 쓴다.
    // 실제 콘텐츠가 올바른지는 content:check·content:ready와 E2E가 맡는다. 더 구체적인 별칭이 먼저 와야 한다
    alias: [
      {
        find: /^@\/content\//,
        replacement: fileURLToPath(
          new URL("./tests/fixtures/content/", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
