# pong-pong

![Language](https://img.shields.io/badge/language-TypeScript-blue?logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Node.js%2024-lightgrey)

42 `ft_transcendence` 과제를 변형한 TypeScript 프로젝트입니다. 브라우저는 입력만 보내고 서버가 공의 위치, 충돌, 점수, 승패를 계산하는 실시간 Pong 웹 서비스로, 매칭, 관전, 채팅, 전적·순위표, 친구, 토너먼트, 관리자 기능을 포함합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `packages/shared` | HTTP·WebSocket·경기 상태 Zod schema(서버와 웹이 함께 사용) |
| `packages/db` | PostgreSQL migration, 저장소 구현, 개발용 메모리 저장소, 관리 CLI |
| `apps/api` | Fastify HTTP 서버, `ws` WebSocket 서버, 경기 simulation과 매칭 |
| `apps/web` | Next.js(App Router) 로비, 경기장, 대시보드, 순위표, 토너먼트 화면 |

`docker-compose.yml`은 `db`(PostgreSQL 16), `migrate`, `api`, `web`, `caddy`를 띄우고, Caddy가 `8080` 포트 하나로 `/api/*`, `/ws`, 웹 화면을 나눠 전달합니다.

## 요구 환경

- Node.js `24.18.1`, pnpm `10.32.1`(`package.json`의 `engines`, `packageManager`)
- Docker Compose v2(전체 스택 실행, PostgreSQL 통합 테스트)

```sh
corepack enable
make install   # pnpm install --frozen-lockfile
```

## 실행

Compose 스택은 `POSTGRES_PASSWORD`, `SESSION_SECRET`, `APP_MODE`를 환경 변수로 받습니다. 주소는 `http://localhost:8080`입니다.

```sh
export POSTGRES_PASSWORD=<값> SESSION_SECRET=<32바이트 이상> APP_MODE=development
docker compose up --build -d   # 또는 make dev(포그라운드)
make down
```

| `APP_MODE` | 로그인 | 용도 |
| --- | --- | --- |
| `development` | `/auth/dev-login` 개발 로그인 | 등록 사용자 기능 확인 |
| `demo` | guest cookie | 비회원 PvP. 6초 안에 상대가 없으면 AI 경기로 전환. 개발 로그인, 친구, 토너먼트, 순위표, 관리자 기능은 닫힘 |
| `production`(Compose 기본값) | 개발·guest 로그인 없음 | `DATABASE_URL` 필수. OAuth 같은 인증 공급자가 없어 새 사용자가 로그인할 수 없음 |
| `test` | 테스트용 경로 | 자동 테스트 |

- `NEXT_PUBLIC_*` 값은 web 빌드에 들어가므로 `APP_MODE`나 공개 주소(`PUBLIC_ORIGIN`, `PUBLIC_WS_URL`)를 바꾸면 web 이미지를 다시 빌드해야 합니다.
- `demo`와 `production`은 `SESSION_SECRET`이 32바이트보다 짧으면 시작하지 않습니다.
- `DATABASE_URL`이 없으면 `production` 외 모드는 메모리 저장소를 쓰고, 재시작하면 상태를 잃습니다.

관리 CLI는 Compose 스택이 떠 있는 상태에서 같은 환경 변수로 실행합니다.

| 명령 | 하는 일 |
| --- | --- |
| `docker compose run --rm api node packages/db/dist/cli.js seed:dev` | NPC와 예시 사용자 생성(migration은 schema만 만듦) |
| `docker compose run --rm api node packages/db/dist/cli.js user:set-role <handle> admin` | 사용자 role 변경 |

## 테스트

```sh
make check   # typecheck, unit-functional, contracts, build, verify-build를 차례로 실행
make postgres-integration   # testcontainers로 PostgreSQL 컨테이너를 띄워 실행(Docker 필요)
```

`make typecheck`, `make unit`, `make contracts`, `make build`, `make verify-build`로 하나씩 실행할 수도 있습니다.

실행 중인 `development` 스택을 대상으로 하는 검사입니다. 사용자·경기 데이터를 남기므로 버려도 되는 DB에서 실행합니다.

```sh
API_BASE_URL=http://localhost:8080/api pnpm smoke:http
API_BASE_URL=http://localhost:8080/api WS_URL=ws://localhost:8080/ws pnpm smoke:ws
E2E_BASE_URL=http://localhost:8080 API_BASE_URL=http://localhost:8080/api pnpm e2e
```

비회원 E2E(`pnpm e2e:guest-demo`)는 `demo`로 빌드한 스택에서 실행합니다. 부하·장애 주입 스크립트(k6, Toxiproxy)와 room scheduler 벤치마크는 `tests/load/`에 있으며 결과는 저장소에 두지 않습니다.

빌드·테스트 산출물은 `make clean`, `node_modules`까지는 `make fclean`, 다시 설치하고 빌드하려면 `make re`로 정리합니다.

## 범위와 제한

- 회원 가입과 운영용 인증(OAuth·OIDC·SAML)이 없습니다.
- 일부 API는 화면이 없습니다(친구 목록·수락·삭제, 본인 프로필 편집, 로그아웃 버튼).
- room scheduler는 API 프로세스 하나를 기준으로 하며 여러 인스턴스 사이의 방 이전은 없습니다.
- 종료 signal을 받으면 새 매칭을 거부하고 진행 중인 방을 최대 60초 기다린 뒤 닫습니다(Compose `stop_grace_period` 70초).
- 브라우저 보간은 snapshot 사이 화면을 부드럽게 할 뿐 네트워크 지연을 줄이지 않습니다.
