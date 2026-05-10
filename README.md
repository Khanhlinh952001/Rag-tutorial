# RAG tutorial

내부 문서·URL을 청크로 나눠 임베딩하고, 벡터 검색 후 학습한 맥락만으로 답하는 **RAG**(Retrieval-Augmented Generation) 예제 **모노레포**입니다.

## 구성

| 디렉터리 | 설명 |
|----------|------|
| `fe/` | Next.js — 채팅(`/chat`), 관리자(`/admin`). 개발 서버 기본 포트 **3003**. |
| `be/` | NestJS + Prisma — API, 문서 수집, 큐, 임베딩. 기본 포트 **3002**. |
| `docs/` | 상세 안내(한국어): 아키텍처, RAG 흐름, API, 트러블슈팅 — [`docs/PROJECT_GUIDE_KO.md`](docs/PROJECT_GUIDE_KO.md) |

## 사전 요구 사항

- Node.js, **pnpm**
- Docker(`be/`의 compose로 PostgreSQL, Redis, Qdrant, Tika 등 실행)

## 빠른 실행

1. **인프라** (`be/`에서):

   ```bash
   cd be && docker compose up -d
   ```

2. **백엔드**: `be/.env-example`을 복사해 `be/.env`로 두고 `DATABASE_URL`, `OPENAI_API_KEY` 등을 채운 뒤:

   ```bash
   cd be
   pnpm install
   pnpm run db:generate
   pnpm run db:migrate
   pnpm run db:seed   # 선택
   pnpm run dev
   ```

3. **프론트엔드**: `fe/.env.example`을 복사해 `fe/.env`로 두거나, `NEXT_PUBLIC_API_BASE_URL=http://localhost:3002`를 맞춘 뒤:

   ```bash
   cd fe
   pnpm install
   pnpm run dev
   ```

4. 브라우저: UI **http://localhost:3003** — 백엔드 API **http://localhost:3002**.

## 더 읽기

- 설치 상세, 자주 나는 오류, 데이터 모델: [`docs/PROJECT_GUIDE_KO.md`](docs/PROJECT_GUIDE_KO.md)
- 스크립트·Prisma: [`be/README.md`](be/README.md)

## 비밀 정보·Git

실제 `.env`는 커밋하지 않습니다. 저장소에는 예시 파일(`be/.env-example`, `fe/.env.example`)만 두는 것을 권장합니다. 무시 규칙은 `be/.gitignore`, `fe/.gitignore`를 참고하세요.
