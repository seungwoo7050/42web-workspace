// [INTV:ARCH] @testing-library/react 기본 사용법은 app/journey/page.test.tsx 참고. 이 파일은
// 그보다 한 단계 더 낮은 수준에서 React의 "서버 렌더링 → 클라이언트 하이드레이션" 과정 자체를
// 재현하는 특이한 테스트를 담고 있다:
// - renderToString: React 엘리먼트를 (테스트 유틸이 아니라) React 자체의 서버 렌더링 API로 HTML
//   문자열로 변환 — Next.js가 서버에서 실제로 하는 것과 같은 일을 테스트 안에서 흉내 낸다.
// - hydrateRoot: 이미 서버가 그려둔 HTML 위에 React를 "재부팅"시켜 이벤트 핸들러 등을 붙이는
//   클라이언트 전용 API(하이드레이션) — 여기서는 그 과정에서 경고가 나는지를 직접 검증하려고
//   의도적으로 저수준 API를 쓴다.
// - act(async () => {...}): React 상태 업데이트가 화면에 다 반영될 때까지 기다렸다가 그다음
//   검증하도록 감싸주는 테스트 유틸 — 이게 없으면 업데이트가 끝나기 전에 assertion이 실행돼 결과가
//   들쭉날쭉해질 수 있다.
// - vi.spyOn(console, "error"): console.error 호출을 가로채 기록만 하고 실제로는 아무것도 안
//   하게(mock) 만든다 — React는 하이드레이션 불일치를 예외를 던지는 대신 console.error로 경고하기
//   때문에, 그 경고가 발생했는지 여부로 "불일치가 있었는지"를 판단해야 한다.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getPortfolioContent } from "@/lib/portfolio";

import { DesignSwitcher } from "./design-switcher";

afterEach(() => cleanup());

describe("DesignSwitcher", () => {
  // [INTV:EDGE] 이 테스트가 재현하는 실제 상황: 브라우저 뒤로가기 등으로 페이지가 복원될 때
  // <details open> 상태는 브라우저가 자체적으로 기억해뒀다가 React가 하이드레이션하기도 전에 미리
  // 되돌려놓을 수 있다 — 그러면 서버가 그려낸 HTML(닫힌 상태)과 브라우저가 실제로 갖고 있는
  // DOM(열린 상태)이 하이드레이션 시점에 서로 다르게 된다. design-switcher.tsx의
  // suppressHydrationWarning이 정확히 이 상황을 위한 설정이고, 이 테스트는 그 설정 덕분에 실제로
  // React가 하이드레이션 불일치 경고를 내지 않는지를 검증한다 — suppressHydrationWarning 하나
  // 빼먹으면 이 정상적인 브라우저 동작이 매번 콘솔 경고로 잘못 보고된다.
  it("tolerates native open state changed before hydration", async () => {
    const content = getPortfolioContent();
    const switcher = (
      <DesignSwitcher
        activeId="editorial"
        contentDebug
        currentPath="/projects"
        defaultId={content.presentation.defaultHomeTemplate}
        templates={content.presentation.templates}
        ui={content.presentation.ui}
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(switcher);
    document.body.append(container);

    const details = container.querySelector("details");
    if (!details) {
      throw new Error("DesignSwitcher must render a details element.");
    }

    details.open = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, switcher);
        await Promise.resolve();
      });

      const hydrationErrors = consoleError.mock.calls
        .flatMap((call) => call.map(String))
        .filter((message) =>
          /hydration|server rendered HTML|did not match/i.test(message),
        );

      expect(details).toHaveAttribute("open");
      expect(hydrationErrors).toEqual([]);
    } finally {
      if (root) {
        await act(async () => root?.unmount());
      }
      consoleError.mockRestore();
      container.remove();
    }
  });

  it("renders selector copy and restores focus when explicitly closed", () => {
    const content = getPortfolioContent();
    const ui = {
      ...content.presentation.ui,
      designSwitcherAriaTemplate: "Choose presentation: {label}",
      designSwitcherCountTemplate: "View {index} of {total}",
      designNavigationAriaLabel: "Presentation choices",
    };

    render(
      <DesignSwitcher
        activeId="editorial"
        contentDebug
        currentPath="/projects"
        defaultId={content.presentation.defaultHomeTemplate}
        templates={content.presentation.templates}
        ui={ui}
      />,
    );

    const summary = screen.getByLabelText("Choose presentation: Editorial");
    expect(summary).toHaveTextContent("View 03 of 05");

    const navigation = screen.getByRole("navigation", {
      hidden: true,
      name: "Presentation choices",
    });
    const classicLink = within(navigation).getByRole("link", {
      hidden: true,
      name: /Classic/,
    });
    const details = summary.closest("details");
    const closeButton = screen.getByRole("button", {
      hidden: true,
      name: ui.designSwitcherCloseLabel,
    });

    expect(details).not.toBeNull();
    expect(classicLink).toHaveAttribute(
      "href",
      "/projects?view=classic&debug=content",
    );
    // fireEvent.click: 실제 마우스 클릭처럼 DOM 이벤트를 발생시켜, design-switcher-close.tsx의
    // onClick 핸들러(닫기 + 포커스를 summary로 되돌리는 로직)가 실제로 동작하는지 끝까지 검증한다.
    details?.setAttribute("open", "");
    fireEvent.click(closeButton);
    expect(details).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });
});
