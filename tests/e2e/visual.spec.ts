import { expect, test, type Locator, type Page } from "@playwright/test";

import { designIds, withExplicitDesign } from "./site-matrix";

// 이 스펙은 tests/fixtures/content로 만든 빌드만 찍는다(playwright.visual.config.ts).
// 실제 콘텐츠가 바뀌어도 기준 이미지는 그대로이고, CSS나 컴포넌트가 바뀔 때만 실패한다.
const fixtureProjectId = "visual-sample";

const hideStickyHeader = "tests/e2e/visual-hide-sticky-header.css";

const screenshotOptions = {
  animations: "disabled",
  maxDiffPixelRatio: 0.01,
} as const;

async function prepareStablePage(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto(path, { waitUntil: "networkidle" });

  expect(response?.ok()).toBe(true);
  await page.evaluate(async () => {
    // 아래쪽 콘텐츠가 처음 그려질 때 lazy 이미지와 글꼴 subset을 늦게 불러와 높이가 바뀐다.
    // 끝까지 한 번 스크롤해 모두 불러온 뒤 기다려야 전체 페이지 스냅샷이 한 번에 안정된다
    for (const image of Array.from(document.images)) {
      image.loading = "eager";
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    window.scrollTo(0, 0);

    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
  });
}

function visualUnit(page: Page, name: string): Locator {
  return page.locator(`[data-visual="${name}"]`);
}

for (const designId of designIds) {
  test.describe(designId, () => {
    test("home", async ({ page }) => {
      await prepareStablePage(page, withExplicitDesign("/", designId));

      // 한 페이지에서 여러 단위를 찍으므로 soft로 단언해 앞 단위가 실패해도 나머지 결과를 모두 남긴다.
      // 전체 페이지는 섹션 사이 간격처럼 단위 스냅샷에 안 잡히는 회귀를 본다
      await expect.soft(page).toHaveScreenshot(`home-${designId}.png`, {
        ...screenshotOptions,
        fullPage: true,
      });
      await expect.soft(visualUnit(page, "header")).toHaveScreenshot(
        `header-${designId}.png`,
        screenshotOptions,
      );

      for (const unit of ["hero", "footer"]) {
        await expect.soft(visualUnit(page, unit)).toHaveScreenshot(
          `${unit}-${designId}.png`,
          { ...screenshotOptions, stylePath: hideStickyHeader },
        );
      }
    });

    test("project card", async ({ page }) => {
      await prepareStablePage(page, withExplicitDesign("/projects", designId));

      const card = visualUnit(page, "project-card").filter({
        has: page.locator(`a[href*="/projects/${fixtureProjectId}"]`),
      });

      await expect(card).toHaveScreenshot(`project-card-${designId}.png`, {
        ...screenshotOptions,
        stylePath: hideStickyHeader,
      });
    });

    test("project hero", async ({ page }) => {
      await prepareStablePage(
        page,
        withExplicitDesign(`/projects/${fixtureProjectId}`, designId),
      );

      await expect(visualUnit(page, "project-hero")).toHaveScreenshot(
        `project-hero-${designId}.png`,
        { ...screenshotOptions, stylePath: hideStickyHeader },
      );
    });
  });
}
