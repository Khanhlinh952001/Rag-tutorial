# RAG tutorial

Mono-repo ví dụ **RAG** (Retrieval-Augmented Generation): tài liệu nội bộ / URL được chunk + embed, truy vấn vector, chat trả lời dựa trên ngữ cảnh đã học.

## Thành phần

| Thư mục | Mô tả |
|---------|--------|
| `fe/` | Next.js — giao diện chat (`/chat`) và quản trị (`/admin`). Cổng dev mặc định **3003**. |
| `be/` | NestJS + Prisma — API, ingest tài liệu, queue, embedding. Cổng mặc định **3002**. |
| `docs/` | Hướng dẫn dài (tiếng Hàn): kiến trúc, luồng RAG, API, troubleshooting — xem [`docs/PROJECT_GUIDE_KO.md`](docs/PROJECT_GUIDE_KO.md). |

## Yêu cầu

- Node.js và **pnpm**
- Docker (PostgreSQL, Redis, Qdrant, Tika, … qua compose trong `be/`)

## Chạy nhanh

1. **Hạ tầng** (từ thư mục `be/`):

   ```bash
   cd be && docker compose up -d
   ```

2. **Backend**: sao chép `be/.env-example` → `be/.env`, điền `DATABASE_URL`, `OPENAI_API_KEY`, v.v. Rồi:

   ```bash
   cd be
   pnpm install
   pnpm run db:generate
   pnpm run db:migrate
   pnpm run db:seed   # tùy chọn
   pnpm run dev
   ```

3. **Frontend**: sao chép `fe/.env.example` → `fe/.env` (hoặc chỉnh `NEXT_PUBLIC_API_BASE_URL=http://localhost:3002`). Rồi:

   ```bash
   cd fe
   pnpm install
   pnpm run dev
   ```

4. Mở trình duyệt: **http://localhost:3003** (UI) — API backend: **http://localhost:3002**.

## Tài liệu thêm

- Chi tiết cài đặt, lỗi thường gặp, mô hình dữ liệu: [`docs/PROJECT_GUIDE_KO.md`](docs/PROJECT_GUIDE_KO.md)
- Script và Prisma cụ thể: [`be/README.md`](be/README.md)

## Bí mật & Git

Không commit file `.env` thật; chỉ commit file mẫu (`be/.env-example`, `fe/.env.example`). Cấu hình ignore nằm trong `be/.gitignore` và `fe/.gitignore`.
