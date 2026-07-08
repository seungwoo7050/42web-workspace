#!/usr/bin/env bash
# 로컬에서 CI와 같은 Playwright Docker 이미지로 비주얼 회귀를 돌린다.
# 저장소를 컨테이너 안에 복사해 빌드하므로 호스트의 node_modules·.next·public은 건드리지 않는다.
# 끝나면 기준 이미지 디렉터리와 test-results·playwright-report만 저장소로 되돌려 놓는다.
set -euo pipefail

cd "$(dirname "$0")/.."

playwright_version="$(node -p 'require("./node_modules/@playwright/test/package.json").version')"
image="mcr.microsoft.com/playwright:v${playwright_version}-noble"
snapshot_dir="tests/e2e/visual.spec.ts-snapshots"

# CI 러너(ubuntu-latest)가 amd64라 Apple Silicon에서도 같은 아키텍처로 렌더링한다
docker run --rm --platform linux/amd64 --ipc=host \
  -v "$PWD":/src \
  -v portfolio-visual-npm-cache:/root/.npm \
  -w /work \
  "$image" \
  bash -c '
    set -uo pipefail
    tar -C /src \
      --exclude=./node_modules --exclude=./.next \
      --exclude=./test-results --exclude=./playwright-report \
      -cf - . | tar -xf -
    npm ci --no-audit --no-fund || exit 1
    bash scripts/visual-container.sh "$@"
    status=$?
    # 컨테이너에 결과가 있을 때만 저장소 쪽을 바꾼다. 빌드가 실패해도 기존 기준 이미지는 남는다
    for dir in "$0" test-results playwright-report; do
      if [[ -d "$dir" ]]; then
        rm -rf "/src/$dir"
        cp -R "$dir" "/src/$dir"
      fi
    done
    exit "$status"
  ' "$snapshot_dir" "$@"
