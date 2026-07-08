import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import playwrightPackage from "@playwright/test/package.json";

import { SITE_DESIGN_IDS } from "./config";

const snapshotDirectory = resolve(
  process.cwd(),
  "tests/e2e/visual.spec.ts-snapshots",
);

const visualUnits = [
  "home",
  "header",
  "hero",
  "footer",
  "project-card",
  "project-hero",
];
const devices = ["chromium", "mobile-chrome"];

// 기준 이미지는 Playwright Docker 이미지(Linux)에서만 만든다
const expectedSnapshotManifest = SITE_DESIGN_IDS.flatMap((designId) =>
  visualUnits.flatMap((unit) =>
    devices.map((device) => `${unit}-${designId}-${device}-linux.png`),
  ),
).sort();

describe("visual regression contract", () => {
  it("keeps the exact Linux desktop and mobile snapshot manifest", () => {
    const actualSnapshotManifest = readdirSync(snapshotDirectory)
      .filter((fileName) => fileName.endsWith(".png"))
      .sort();

    expect(actualSnapshotManifest).toEqual(expectedSnapshotManifest);
  });

  it("runs CI in the Playwright image that matches the installed version", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    // 로컬 scripts/visual-docker.sh는 설치된 버전으로 태그를 고른다. CI만 어긋나면 기준 이미지와 렌더링이 달라진다
    expect(workflow).toContain(
      `image: mcr.microsoft.com/playwright:v${playwrightPackage.version}-noble`,
    );
  });
});
