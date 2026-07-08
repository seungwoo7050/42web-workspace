#!/usr/bin/env bash
# 고정 fixture 콘텐츠로 빌드하고 비주얼 회귀를 돌린다.
# 기준 이미지가 Linux Chromium 렌더링이므로 Playwright 공식 Docker 이미지 안에서만 실행한다.
# 로컬에서는 visual-docker.sh가 컨테이너 안에서 이 스크립트를 부르고, CI는 같은 이미지의 job에서 직접 부른다.
# 인자는 그대로 playwright test에 넘긴다(예: --update-snapshots).
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "visual-container.sh는 Playwright Docker 이미지 안에서만 실행합니다. 로컬에서는 npm run test:visual을 쓰세요." >&2
  exit 1
fi

# fixture 자산은 public/content/visual-fixture로 들어가 실제 자산과 섞이지 않는다
cp -R tests/fixtures/public/. public/

PORTFOLIO_CONTENT_DIR=tests/fixtures/content npx next build --webpack
npx playwright test --config=playwright.visual.config.ts "$@"
