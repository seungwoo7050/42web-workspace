# portfolio-template

![Language](https://img.shields.io/badge/language-TypeScript-blue?logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Node.js-lightgrey)

Next.js 16(App Router, React 19)으로 만든 포트폴리오 사이트 템플릿입니다. `src/content`의 JSON으로 프로필·프로젝트·연락처 페이지를 만들고, 같은 콘텐츠를 다섯 가지 디자인(Design, Classic, Editorial, Brutalist, Cinematic) 중 하나로 보여 줍니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/content/` | 사이트 콘텐츠 JSON(`site.json`, `profile.json`, `projects.json` 등) |
| `src/designs/` | 다섯 디자인의 renderer |
| `src/app/` | route와 metadata(`robots.ts`, `sitemap.ts`) |
| `public/template/` | 예제 콘텐츠가 가리키는 자산 |
| `scripts/` | 콘텐츠 검사, 빌드 산출물·bundle·컨테이너 검사 스크립트 |

## 요구 환경

- Node.js `24.18.0`, npm `11.16.0` (`.nvmrc`, `package.json`의 `engines`)
- E2E 테스트: Playwright Chromium (`npx playwright install chromium`)
- 컨테이너 검사: Docker

## 실행

```sh
npm ci
npm run dev
```

| 명령 | 내용 |
| --- | --- |
| `npm run dev` | 개발 서버, `http://localhost:3100` |
| `npm run build` | 콘텐츠 검사(`prebuild`) 후 `next build --webpack`, standalone 산출물은 `.next/standalone/` |
| `npm run start` | 빌드한 결과를 `http://localhost:3100`에서 실행 |

Docker 이미지는 다음과 같이 빌드하고 실행합니다. production 모드로 빌드하려면 `--build-arg PORTFOLIO_CONTENT_MODE=production --build-arg SITE_URL=...`을 더합니다.

```sh
docker build -t portfolio-template .
docker run --rm -p 3100:3100 portfolio-template
```

같은 작업을 `make install`, `make dev`, `make build`, `make start`로도 할 수 있고, `make help`가 전체 타깃을 보여 줍니다.

## 콘텐츠 바꾸기

- 문구와 데이터는 `src/content/*.json`을 고칩니다. 페이지 켜기·끄기는 `site.json`의 `pages`, 프로젝트는 `projects.json`에 있습니다.
- 실제 공개용 이미지·이력서 파일은 `public/content/` 아래에 두고 JSON에서 `/content/...`로 가리킵니다.
- 기본 디자인은 `presentation.json`의 `defaultHomeTemplate`(기본값 `editorial`)으로 정합니다. 방문자는 `?view=design|classic|editorial|brutalist|cinematic`으로 바꿔 볼 수 있습니다.
- `?debug=content`를 붙이면 화면의 문구가 어느 JSON 위치에서 왔는지 표시합니다.

콘텐츠 mode는 `PORTFOLIO_CONTENT_MODE`로 정합니다.

| mode | 동작 |
| --- | --- |
| `template` (기본) | 예제 값을 허용하고 검색 엔진 색인을 막습니다. |
| `production` | placeholder 문구, `public/content/` 밖 자산, 빠진 프로필·소셜 이미지·이력서가 있거나 공개 URL이 있는 프로젝트, 실제 연락처가 하나도 없으면 실패합니다. `SITE_URL`에 실제 공개 origin이 필요합니다. |

배포 전에는 다음으로 검사합니다. `npm run build`도 `prebuild`에서 두 검사를 먼저 실행하므로 production 검사에 실패하면 빌드가 멈춥니다.

```sh
npm run content:check   # JSON schema, 참조, 자산 경로
PORTFOLIO_CONTENT_MODE=production SITE_URL="https://<공개 도메인>" npm run content:ready
```

## 테스트

```sh
npm run lint
npm run typecheck
npm run test                  # Vitest 단위 테스트
npm run test:e2e:production   # production 빌드 후 Playwright E2E
```

| 명령 | 내용 |
| --- | --- |
| `npm run test:e2e` | 개발 서버 대상 Playwright E2E |
| `npm run test:visual` | 고정 fixture 빌드로 비주얼 회귀 비교(Docker 필요) |
| `npm run test:visual:update` | 비주얼 기준 이미지 다시 만들기(Docker 필요) |
| `npm run build:verify` | standalone 산출물과 필수 파일 검사 |
| `npm run bundle:check` | route별 client bundle을 저장된 기준값과 비교 |
| `npm run lighthouse:audit` | Lighthouse 기준 검사 |
| `npm run test:container` | Docker 이미지를 빌드해 route와 정적 자산 응답 검사 |

`test:e2e:production`의 production은 Next production 서버를 뜻하며 `PORTFOLIO_CONTENT_MODE`를 바꾸지 않습니다. `make check`는 콘텐츠 검사, lint, typecheck, 단위 테스트를 한 번에 실행합니다.

### 비주얼 회귀

검사 대상마다 입력을 나눕니다.

| 검사 대상 | 입력 | 수단 |
| --- | --- | --- |
| 콘텐츠가 올바른지 | `src/content/*.json` | `content:check`, `content:ready` |
| 기능과 구조가 올바른지 | `src/content/*.json` | Playwright E2E(role과 텍스트) |
| 겉모습이 회귀했는지 | `tests/fixtures/content/*.json` | 비주얼 스냅샷 |

비주얼 스냅샷은 실제 콘텐츠가 아니라 고정 fixture로 빌드한 사이트를 찍습니다. 그래서 `src/content`를 아무리 고쳐도 기준 이미지는 그대로이고, CSS나 컴포넌트가 바뀔 때만 실패합니다. fixture에는 긴 제목, 여러 줄 한글, 사진 없음, 상세 이미지 0장·여러 장 같은 까다로운 경우를 일부러 넣었습니다.

- 디자인마다 전체 홈과 `data-visual` 표식이 붙은 header, hero, footer, `visual-sample` 카드, 상세 hero를 데스크톱·모바일에서 찍습니다. 실패하면 어느 단위가 깨졌는지 이름으로 보입니다.
- 기준 이미지는 CI와 같은 Playwright 공식 Docker 이미지(linux/amd64)에서만 만듭니다. 운영체제마다 글꼴 렌더링이 달라 macOS·Windows에서 만든 이미지는 CI에서 통과하지 않습니다. 파일 이름에 플랫폼이 들어가며 `*-linux.png`만 커밋합니다.
- `npm run test:visual`은 저장소를 컨테이너 안에 복사해 빌드하므로 로컬 `node_modules`, `.next`, `public`을 바꾸지 않습니다. Apple Silicon에서는 amd64 에뮬레이션이라 몇 분 걸립니다.
- CI의 `visual` job이 같은 비교를 하고, 실패하면 diff 이미지를 `visual-results` artifact로 남깁니다. 이 job이 통과해야 배포합니다.

운영 규칙:

1. 디자인을 의도해서 바꿨다면 같은 커밋에서 `npm run test:visual:update`로 기준 이미지를 갱신하고, 바뀐 이미지를 직접 열어 의도한 변화만 있는지 확인합니다.
2. 의도하지 않았는데 실패했다면 기준 이미지를 갱신하지 말고 `test-results/`의 `*-diff.png`로 원인을 찾습니다.
3. 콘텐츠를 바꾼 커밋에서 비주얼 회귀가 실패하면 콘텐츠가 아니라 그 커밋의 다른 변경을 의심합니다.
4. 새 화면 요소를 검사하려면 컴포넌트에 `data-visual` 표식을 달고, 필요한 경우를 `tests/fixtures/content`에 추가합니다. fixture도 실제 콘텐츠와 같은 스키마 검사를 통과해야 합니다.
5. `@playwright/test`를 올리면 CI의 Playwright 이미지 태그도 같이 올리고 기준 이미지를 다시 만듭니다. 둘이 어긋나면 단위 테스트가 실패합니다.

## 범위와 제한

- CMS, 데이터베이스, 인증, 관리자 편집 화면이 없습니다. 콘텐츠는 JSON 파일을 직접 고칩니다.
- 특정 호스팅, reverse proxy, TLS 설정은 포함하지 않습니다.
- Dockerfile의 runner 단계에는 `PORTFOLIO_CONTENT_MODE`와 `SITE_URL`이 없습니다. production으로 빌드한 이미지도 실행할 때 `-e PORTFOLIO_CONTENT_MODE=production -e SITE_URL=...`을 함께 넘겨야 합니다.
- readiness 검사는 형식과 placeholder 표시만 확인하며 문구의 사실 여부는 판정하지 않습니다.
- bundle과 Lighthouse 기준값은 저장된 과거 측정값입니다.
