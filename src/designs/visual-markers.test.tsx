import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "@/app/page";
import ProjectDetailPage from "@/app/projects/[projectId]/page";
import ProjectsPage from "@/app/projects/page";
import { getPortfolioContent } from "@/lib/portfolio";

import { SITE_DESIGN_IDS } from "./config";

afterEach(() => cleanup());

const firstProject = getPortfolioContent().projects[0];

if (!firstProject) {
  throw new Error("Visual marker checks require at least one enabled project.");
}

function countMarkers(container: HTMLElement, marker: string) {
  return container.querySelectorAll(`[data-visual="${marker}"]`).length;
}

// tests/e2e/visual.spec.ts가 이 표식으로 컴포넌트 단위 스냅샷을 찍는다
describe.each(SITE_DESIGN_IDS)("%s visual markers", (designId) => {
  it("marks one header, hero, and footer on home", async () => {
    const { container } = render(
      await Home({ searchParams: Promise.resolve({ view: designId }) }),
    );

    expect(countMarkers(container, "header")).toBe(1);
    expect(countMarkers(container, "hero")).toBe(1);
    expect(countMarkers(container, "footer")).toBe(1);
  });

  it("marks every project card on the project archive", async () => {
    const { container } = render(
      await ProjectsPage({ searchParams: Promise.resolve({ view: designId }) }),
    );
    const cards = container.querySelectorAll('[data-visual="project-card"]');

    expect(cards.length).toBeGreaterThan(0);
    expect(
      Array.from(cards).some((card) =>
        card.querySelector(`a[href*="/projects/${firstProject.id}"]`),
      ),
    ).toBe(true);
  });

  it("marks one project hero on project detail", async () => {
    const { container } = render(
      await ProjectDetailPage({
        params: Promise.resolve({ projectId: firstProject.id }),
        searchParams: Promise.resolve({ view: designId }),
      }),
    );

    expect(countMarkers(container, "project-hero")).toBe(1);
  });
});
