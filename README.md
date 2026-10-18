# 42web-workspace

![Platform](https://img.shields.io/badge/platform-Docker-lightgrey)
![Build](https://img.shields.io/badge/build-Make-lightgrey)

42 과정의 웹·인프라 과제를 변형해 다시 구현한 프로젝트와 포트폴리오 사이트 템플릿 프로젝트를 모은 저장소입니다.

프로젝트마다 공통 조상이 없는 독립 브랜치를 쓰고, 이 브랜치(`main`)에는 이 문서만 있습니다.

## 프로젝트

| 프로젝트 | 원 과제 | 설명 |
| --- | --- | --- |
| [pong-pong](https://github.com/seungwoo7050/42web-workspace/tree/pong-pong) | `ft_transcendence` | 서버가 경기를 판정하는 실시간 Pong 웹 서비스(TypeScript, Next.js, Fastify, PostgreSQL) |
| [container-stack](https://github.com/seungwoo7050/42web-workspace/tree/container-stack) | `Inception` | nginx, WordPress, MariaDB를 직접 빌드해 운영하는 Docker Compose 스택(Python 운영 도구) |
| [portfolio-template](https://github.com/seungwoo7050/42web-workspace/tree/portfolio-template) | . | JSON 콘텐츠를 다섯 가지 디자인으로 보여 주는 포트폴리오 사이트 템플릿(TypeScript, Next.js) |

## 브랜치 받기

```sh
git clone https://github.com/seungwoo7050/42web-workspace.git
cd 42web-workspace
git switch pong-pong                                   # 프로젝트 브랜치로 전환
git worktree add ../container-stack container-stack    # 다른 브랜치를 옆 디렉터리에 함께 체크아웃
```

## 공통 규약

- 각 브랜치 루트의 `Makefile`이 빌드, 실행, 테스트, 정리 명령의 진입점입니다. `make help`로 대상 목록을 봅니다.
- Docker로 실행합니다. pong-pong과 container-stack은 Docker Compose v2로 전체 스택을 띄우고, portfolio-template은 Dockerfile 하나로 이미지를 만듭니다.
- `.env`와 비밀번호 같은 비밀값은 Git에 넣지 않고, 필요한 값은 각 브랜치 README의 "요구 환경"과 "실행"에 적습니다.
- 커밋 메시지는 `type(scope): 요약` 형식을 씁니다(scope는 생략할 수 있습니다).
