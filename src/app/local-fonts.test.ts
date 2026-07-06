import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const layoutSource = readFileSync(
  resolve(projectRoot, "src/app/layout.tsx"),
  "utf8",
);

// [INTV:ARCH] layout.tsx가 참조하는 폰트 경로가 실제로 레포에 커밋된 유효한 파일을 가리키는지,
// 그리고 그 폰트들이 라이선스 고지까지 갖췄는지를 검사한다 — 참조(문자열)와 실제 자산(바이너리
// 파일)이 둘 다 맞아야 통과하는 배선(wiring) 검증이다.
describe("local font registration", () => {
  // [INTV:ARCH] it.each([[인자1, 인자2], ...])(제목 템플릿, (인자1, 인자2) => {...}): 같은
  // 테스트 로직을 여러 입력값에 대해 반복 실행하는 "표(table) 기반" 테스트 문법 — 폰트 파일
  // 3개마다 매번 it()을 따로 쓰지 않고 배열 하나로 표현한다. 제목의 %s는 각 실행마다 해당
  // 인자값으로 치환되어 리포트에 어떤 케이스인지 표시된다.
  it.each([
    ["./fonts/Geist-Variable.woff2", "Geist-Variable.woff2"],
    ["./fonts/GeistMono-Variable.woff2", "GeistMono-Variable.woff2"],
    [
      "./fonts/SourceHanSerifKR-Variable.woff2",
      "SourceHanSerifKR-Variable.woff2",
    ],
  ])("keeps %s as a valid repository asset", (sourcePath, fileName) => {
    expect(layoutSource).toContain(sourcePath);

    // [INTV:EDGE] 파일의 처음 4바이트("매직 넘버")로 실제 포맷을 확인 — 확장자가 .woff2라고
    // 적혀 있어도 내용이 다른 형식이거나 손상됐을 수 있으니, 파일 시그니처("wOF2"는 WOFF2 폰트
    // 포맷의 표준 식별 바이트)를 직접 검사해 "이름만 폰트 파일이 아니라 실제로 유효한 WOFF2
    // 파일"임을 보장한다.
    const font = readFileSync(resolve(projectRoot, "src/app/fonts", fileName));
    expect(font.subarray(0, 4).toString("ascii")).toBe("wOF2");
  });

  // [INTV:EDGE] 오픈소스 폰트(SIL Open Font License)를 배포할 때는 라이선스 고지 파일을 함께
  // 포함해야 한다는 조건이 있어서, 그 준수 여부까지 테스트로 강제해둔 것 — 코드 동작과는 무관하지만
  // 라이선스 컴플라이언스도 "테스트로 깨지면 바로 알아채야 하는 요구사항"으로 다루고 있다는 점.
  it.each([
    "Geist-OFL-1.1.txt",
    "SourceHanSerif-OFL-1.1.txt",
  ])("keeps the license notice for %s", (fileName) => {
    const license = readFileSync(
      resolve(projectRoot, "src/app/fonts/licenses", fileName),
      "utf8",
    );

    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});
