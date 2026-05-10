# 📘 Dự án hướng dẫn RAG — Bản hướng dẫn toàn bộ cho mọi người

> Tài liệu này viết bằng **tiếng Việt rất dễ**, khoảng trình độ **lớp 5 tiểu học** cũng có thể theo dõi.  
> Những chỗ khó sẽ được giải thích bằng **ví dụ** và **so sánh** (ẩn dụ).

---

## Mục lục

1. [Giới thiệu dự án](#1-giới-thiệu-dự-án)
2. [Kiến trúc tổng thể — Hiểu qua ví dụ trường học](#2-kiến-trúc-tổng-thể--hiểu-qua-ví-dụ-trường-học)
3. [Công nghệ đã dùng — Giải thích từng cái](#3-công-nghệ-đã-dùng--giải-thích-từng-cái)
4. [Thứ tự AI làm việc — 9 bước](#4-thứ-tự-ai-làm-việc--9-bước)
5. [Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
6. [API — Đơn hàng gửi ra ngoài cửa](#6-api--đơn-hàng-gửi-ra-ngoài-cửa)
7. [Cơ sở dữ liệu — Lưu những gì?](#7-cơ-sở-dữ-liệu--lưu-những-gì)
8. [RAG — Giống như tìm sách trong thư viện](#8-rag--giống-như-tìm-sách-trong-thư-viện)
9. [Cách chạy — Làm theo từng bước](#9-cách-chạy--làm-theo-từng-bước)
10. [Lỗi thường gặp & cách xử lý](#10-lỗi-thường-gặp--cách-xử-lý)
11. [Khi muốn phát triển dịch vụ sau này](#11-khi-muốn-phát-triển-dịch-vụ-sau-này)
12. [Hướng dẫn hiệu năng và xử lý traffic (chi phí · mở rộng · vận hành)](#12-hướng-dẫn-hiệu-năng-và-xử-lý-traffic-chi-phí--mở-rộng--vận-hành)
13. [Tóm lại](#13-tóm-lại)

---

## 1. Giới thiệu dự án

### Dự án này là gì?

Đây là **ví dụ xây một dịch vụ web**: cho AI “học” **tài liệu công ty/trường** (file, trang web, bảng trong DB), rồi **chỉ dựa trên nội dung đó** để trả lời câu hỏi.

- 📁 Có thể tải lên **file** kiểu PDF, Word, v.v.
- 🌐 Có thể **lấy chữ từ địa chỉ web** để AI học.
- 🗄️ Có thể **kết nối cơ sở dữ liệu bên ngoài**.
- 💬 **Người dùng** chat hỏi; **quản trị** quản lý tài liệu và cấu hình.

### Nó giải quyết vấn đề gì?

| Nỗi băn khoăn | Dự án này làm gì |
|---------------|------------------|
| “ChatGPT không biết tài liệu nội bộ công ty” | Làm AI **chỉ nhìn tài liệu chúng ta đưa vào** rồi trả lời (RAG). |
| “File quá nhiều, người không đọc hết” | Chia nhỏ file, **chỉ lấy mảnh liên quan** khi hỏi. |
| “Thông báo chỉ có trên web, cũng muốn AI biết” | Cho URL, **học giống các nguồn khác**. |

### Ai làm được gì?

| Vai trò | Có thể làm (đại diện) |
|---------|------------------------|
| **Người dùng** | Đăng nhập rồi **chat AI** (`/chat`). Dán **một dòng chỉ có URL** — hệ thống có thể học trang đó rồi trả lời. |
| **Quản trị** | Tải file, quét web, kết nối DB ngoài, xóa tài liệu, v.v. (`/admin/...`). |

### Luồng tổng thể — Nhìn một lần

```text
[Người dùng] đưa file · URL
    → [Giao diện web] gửi về backend
    → [Backend] trích chữ → cắt nhỏ → đổi sang số (embedding)
    → [Vector DB] cất các mảnh vào “sổ địa chỉ theo nghĩa”
[Người dùng] hỏi
    → Tìm mảnh giống câu hỏi → AI ghép “câu hỏi + mảnh” để tạo đáp án
    → [Màn hình] hiển thị đáp án
```

So sánh: **Nhập sách vào thư viện (học tài liệu), rồi thầy cô AI chỉ nhìn sách đó để giúp làm bài.**

---

## 2. Kiến trúc tổng thể — Hiểu qua ví dụ trường học

**Kiến trúc** là bức tranh **chia phòng trong tòa nhà, ai làm việc gì.**

### Bảng tổng quan

| Phần | Một dòng | Ẩn dụ dễ hiểu |
|------|-----------|---------------|
| **Frontend** (Next.js) | **Màn web** ta bấm chuột | 🏫 **Cổng trường · bảng tin lớp** — đọc chữ, bấm nút là báo cho “giáo viên” (server) biết. |
| **Backend** (NestJS) | **Văn phòng trung tâm** làm đúng quy định | 🏢 **Phòng ban giảng dạy** — xử lý “file của ai”, “đang học chưa”, v.v. |
| **AI server (OpenAI API)** | **Bộ não viết đáp án** | 👨‍🏫 **Đầu óc giáo viên** — chỉ xem vài trang giáo trình đã nhét vào và viết đáp. (ở đây máy chủ của OpenAI đóng vai giáo viên) |
| **Database** (PostgreSQL) | **Bảng biểu ghi chép**: user, danh sách tài liệu, tin chat | 📝 **Sổ văn thư nhà trường** — ai là ai, đã giao việc gì. |
| **Vector Database** (Qdrant hoặc pgvector) | **Chỉ mục tìm nhanh** “mảnh nào gần nghĩa với câu” | 📇 **Thư mục thẻ + hộp phân loại trong thư viện**. |
| **File Storage** (ổ đĩa `uploads/` v.v.) | **Nơi file gốc thật sự được cất** | 🏭 **Kho đồ** — để nguyên hộp file, cần thì mang ra đọc. |

### Redis + BullMQ (hàng chờ việc)

| Phần | Ẩn dụ |
|------|--------|
| **Redis** | 🔔 **Miếng nhớ ngay cửa** — ghi “số thứ tự đang làm” rất nhanh. |
| **BullMQ** | 📋 **Hàng xếp chỗ** — nhiều file thì **không ép xử lý cùng lúc**, làm **từng việc**. |

---

## 3. Công nghệ đã dùng — Giải thích từng cái

Mỗi mục: **là gì / vì sao / trong dự án / ví dụ / ưu / nhược.**

### Next.js

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | **Framework** dùng với React để làm trang web, “điều hướng trang tiếp theo” dễ hơn. |
| **Vì sao?** | Chuyển trang nhanh, dev nhanh, triển khai tốt. |
| **Vai trò** | **Giao diện** người dùng & quản trị (`fe/`). |
| **Ví dụ** | Như có **catalog Lego** làm nhà có phòng có cửa sẵn. |
| **Ưu** | Nhiều người biết, tài liệu nhiều. |
| **Nhược** | Ban đầu khá nhiều khái niệm (server · client). |

### NestJS

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | **Khung** backend cho Node.js — gom API theo chức năng. |
| **Vì sao?** | Dự án lớn dần thì chia file **theo vai trò** dễ quản lý. |
| **Vai trò** | Toàn bộ **`be/`** — upload, chat, tài liệu, đăng nhập, v.v. |
| **Ví dụ** | Như trường có **phòng khối học**. |
| **Ưu** | Cấu trúc gọn; hợp TypeScript. |
| **Nhược** | Lúc mới vào decorator hơi lạ. |

### PostgreSQL

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | DB **bảng hàng và cột** rất tin cậy. |
| **Vì sao?** | User, tài liệu, tin chat **cần chính xác**. |
| **Vai trò** | Chỗ ở của mọi mô hình Prisma. |
| **Ví dụ** | Giống **nhiều sheet Excel chồng lại trong sổ kế toán**. |
| **Ưu** | Tin cậy; transaction mạnh. |
| **Nhược** | Tìm theo **nghĩa** thường kết hợp **vector DB** sẽ đỡ hơn. |

### Prisma ORM

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Công cụ **đỡ viết tay SQL**. |
| **Vì sao?** | Giảm lỗi; TypeScript và DB **khớp kiểu**. |
| **Vai trò** | Định nghĩa bảng trong `schema.prisma`; code dùng `findMany` v.v. |
| **Ví dụ** | Thay vì nhắn SQL như tiếng nước ngoài — **đặt lệnh bằng cấp độ JS/TS**. |
| **Ưu** | An toàn kiểu; migration tiện. |
| **Nhược** | SQL rất khó có lúc vẫn phải tự viết. |

### OpenAI API

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | **AI trên đám mây của OpenAI** kết qua Internet. |
| **Vì sao?** | Không cần máy siêu khổng lồ ở nhà vẫn **thuê môn hình xa**. |
| **Vai trò** | Viết câu trả lời; (tuỳ cấu hình) tạo embedding. |
| **Ví dụ** | Gọi **điện hỏi chuyên gia** — mình chỉ gửi câu hỏi + tài liệu đính kèm. |
| **Ưu** | Hiểu ngôn ngữ tốt. |
| **Nhược** | **Chi phí**; Internet lỗi là ảnh hưởng; cần API key. |

### RAG (Retrieval-Augmented Generation)

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | **Tìm tài liệu liên quan trước**, rồi mới sinh đáp án text. |
| **Vì sao?** | Giảm **bịa không có trong tài liệu** và bám **dữ liệu của ta** hơn. |
| **Vai trò** | Nguyên lý cốt lõi của app. |
| **Ví dụ** | Thi chỉ **mở đúng vài trang sách được phép mang vào**. |
| **Ưu** | Dùng thông tin nội bộ / site của mình. |
| **Nhược** | Tài liệu yếu thì đáp án yếu. |

### Vector Database (vector DB)

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Cất mảnh chữ đã đổi thành **vectơ số**, tìm nhanh hướng “gần nghĩa” với câu hỏi. |
| **Vì sao?** | Tìm **đồng nghĩa** dù không cùng từ. |
| **Vai trò** | Theo biến môi trường **Qdrant** hoặc **PostgreSQL + pgvector**. |
| **Ví dụ** | Giống tìm **nhà láng giềng** trên bản đồ — chỉ là chữ được biểu diễn bằng nhiều chiều. |
| **Ưu** | Mạnh ở tìm kiếm theo ngữ nghĩa. |
| **Nhược** | Ghép một mình khi chỉ cần “chuỗi khớp 100%” đôi khi không hợp. |

### Qdrant hoặc pgvector

| Hạng mục | Mô tả |
|----------|-------|
| **Qdrant** | Hộp **chuyên cho vector**. Docker mở cổng `6333`. |
| **pgvector** | **Mở rộng** PostgreSQL thêm cột vector — một DB xử lý bảng + tìm vector. |
| **Dự án này** | Chọn bằng biến `VECTOR_STORE` (`qdrant` / `pgvector`). |
| **Ví dụ** | Qdrant = **ngăn dụng cụ chuyên**; pgvector = **kệ sách cũ thêm ngăn chỉ mục**. |

### Redis

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Kho **đọc ghi cực nhanh trên RAM**. |
| **Vì sao?** | Hàng đợi (BullMQ) cần “bảng ghỉ số thứ tự” nhanh. |
| **Vai trò** | Hàng đợi / lock v.v. (Docker `6379`). |
| **Ví dụ** | Ghi **số thứ tự lên bảng**. |
| **Ưu** | Tốc độ. |
| **Nhược** | Tắt điện có thể mất dữ liệu tạm — **không nên** dùng cho dữ liệu quan trọng lâu dài. |

### BullMQ

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Thư viện tạo **hàng chờ công việc**. |
| **Vì sao?** | File lớn xử lý lâu — user chỉ cần **nhận phiếu**, xử lý chậm phía sau. |
| **Vai trò** | Xử lý tài liệu **bất đồng bộ**. |
| **Ví dụ** | Ngân hàng **lấy số xếp hàng** rồi làm theo thứ tự. |
| **Ưu** | Server ít bị nghẽn. |
| **Nhược** | Cần Redis; phải thiết kế **thử lại khi lỗi**. |

### Docker

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Gói chương trình vào **container** để chạy **gần giống** trên mọi máy. |
| **Vì sao?** | Giảm “máy tôi chạy được máy bạn không”. |
| **Vai trò** | `docker-compose.yml` chạy DB, Qdrant, Redis, Tika, v.v. |
| **Ví dụ** | Hộp cơm **nắp kín** — đồ ăn bên trong ít bị rung theo môi trường ngoài. |
| **Ưu** | Đồng đội cùng môi trường. |
| **Nhược** | Cài Docker; tốn dung lượng. |

### AWS hoặc kiến trúc máy chủ

| Hạng mục | Mô tả |
|----------|-------|
| **Tutorial này** | Mặc định **máy cá nhân + Docker**. |
| **Sau này** | Đưa lên **VM trên AWS, GCP** — dùng từ Internet mọi nơi. |
| **Ví dụ** | Giờ là **chơi cửa hàng ở nhà**; cloud là **treo biển hiệu thật**. |

### Tailwind CSS

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Dùng **class** để set màu, khoảng cách, cỡ chữ nhanh. |
| **Vì sao?** | Viết style ngắn; giao diện đồng bộ. |
| **Vai trò** | Style UI `fe/`. |
| **Ví dụ** | Dán **nhãn** lên quần áo: “nền xanh”, “chữ to”. |
| **Ưu** | Làm nhanh. |
| **Nhược** | HTML nhìn dài. |

### shadcn/ui + Radix

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Bộ **mảnh UI** (nút, hộp thoại) copy vào dùng. |
| **Vì sao?** | Truy cập bàn phím / screen reader tốt; có sẵn mẫu đẹp. |
| **Vai trò** | **Button**, **Input** trên admin & chat. |
| **Ví dụ** | Mua **ngăn kéo ráp sẵn** ở cửa hàng nội thất. |

### TypeScript

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | JavaScript + **kiểu** (đây là số, đây là chuỗi). |
| **Vì sao?** | Bắt nhiều lỗi **lúc gõ code**. |
| **Vai trò** | Gần như toàn `fe/`, `be/`. |
| **Ví dụ** | Bài tập có kèm **dòng gợi ý “dạng bài là gì”**. |

### Xác thực JWT

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Sau khi đăng nhập thành công nhận **token** ngắn; mỗi lần gọi API “đây là tôi”. |
| **Vì sao?** | Gửi mật khẩu mỗi lần là nguy hiểm. |
| **Vai trò** | `POST /auth/login`, bảo vệ API chat & admin. |
| **Ví dụ** | **Vòng tay công viên** — một ngày chứng minh vào cửa. |
| **Ưu** | Server đỡ phải giữ session nặng. |
| **Nhược** | Token bị đánh cắp → cần hết hạn, HTTPS. |

### PDF Parser (pdf-parse v.v.)

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Công cụ **trích chữ từ PDF**. |
| **Vì sao?** | PDF nhìn như ảnh nhưng bên trong cấu trúc phức tạp. |
| **Vai trò** | Lấy text tài liệu upload. |
| **Ví dụ** | Từ sách scan **gõ lại chỉ phần chữ**. |

### OCR (nhận dạng ký tự quang học)

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Máy **đọc chữ trong ảnh**. |
| **Vì sao?** | Slide chỉ là ảnh thì không bắt được chữ thường. |
| **Dự án này** | Ví dụ PPTX có thể bật OCR bằng biến môi trường; HWP dùng **Apache Tika** server để trích. |
| **Ví dụ** | Nhìn biển quảng cáo trong ảnh rồi **chép tay**. |
| **Ưu** | Tài liệu scan được. |
| **Nhược** | Chậm; đôi khi sai. |

### Embedding (nhúng vector)

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Đổi câu văn thành **dãy số (vector)** biểu diễn “vị trí nghĩa”. |
| **Vì sao?** | Câu gần nghĩa thường có vector gần nhau. |
| **Vai trò** | Bước chuẩn bị cho tìm kiếm & RAG. |
| **Ví dụ** | Bài test tính cách ra **điểm** rồi tìm người giống điểm. |
| **Ưu** | Tìm theo ngữ nghĩa. |
| **Nhược** | Chi phí & thời gian; mỗi mô hình “cảm giác” khác nhau. |

### Chunking (chia đoạn)

| Hạng mục | Mô tả |
|----------|-------|
| **Là gì?** | Cắt bài dài thành **mảnh nhỏ**. |
| **Vì sao?** | AI khó nhét cả chục ngàn ký tự một lần; **chỉ gắp phần cần** dễ hơn. |
| **Vai trò** | Chia text tài liệu / web rồi embedding từng mảnh. |
| **Ví dụ** | Bài phát biểu dài → **thẻ từng đoạn**. |
| **Ưu** | Tìm giàu chi tiết hơn. |
| **Nhược** | Cắt quá nhỏ thì ngữ cảnh đứt — **cỡ đoạn** rất quan trọng. |

---

## 4. Thứ tự AI làm việc — 9 bước

Đây là **pipeline RAG điển hình**. (Một số trường hợp như chỉ dán URL một dòng trong chat có thể hơi khác thứ tự.)

| Bước | Việc thực tế | Vì sao cần? | Ẩn dụ | Ví dụ nhỏ |
|------|----------------|-------------|-------|-----------|
| **1. Upload** | User gửi file hoặc URL | Có nguyên liệu cho AI đọc | Hiến sách cho thư viện | Bấm “thêm” PDF |
| **2. Server nhận** | Lưu file đĩa, ghi DB | Sau biết “file nào” | Dán mã lô hàng lên kho | Thư mục `uploads/` + dòng `Document` |
| **3. Trích text** | Lấy chữ từ PDF/HTML/... | AI cần chữ | Bỏ hình chỉ giữ chữ | `pdf-parse`, `cheerio` (HTML) |
| **4. Chunk** | Cắt bài thành nhiều mảnh | Nhét cả bài một lần quá dài, search khó | Cắt trái cây từng miếng vừa ăn | Mỗi mảnh vài trăm ~ vài ngàn ký tự |
| **5. Embedding** | Mỗi mảnh → vector | So sánh “gần nghĩa” bằng máy | Gắn **tọa độ** cho mảnh | Vector ~1536 chiều |
| **6. Lưu Vector DB** | Lưu vector kèm chữ gốc | Hỏi tới là tìm láng giềng nhanh | Bỏ thẻ chỉ mục vào hộp | Qdrant hoặc pgvector |
| **7. Câu hỏi** | User gõ chat | Định hướng câu trả lời | Đưa thẻ câu hỏi cho thầy | “Điểm chính tài liệu này là gì?” |
| **8. Search** | Embedding câu hỏi, lấy **top-K** mảnh | Không nhét cả trăm trang không liên quan | Chỉ mở phần trong phạm vi thi | Thường 5–10 mảnh |
| **9. Sinh đáp án** | Gửi câu hỏi + mảnh lên OpenAI | Có đoạn hoàn chỉnh cho người đọc | Mở sách viết bài tóm tắt | Trả lời markdown |

---

## 5. Cấu trúc thư mục

Mono repo chia khoảng như sau (tên có thể lệch chút).

```text
Rag-tutorial/
├── fe/                    # Frontend (Next.js) — màn hình người dùng
│   ├── app/               # Trang: /, /chat, /admin, …
│   ├── components/        # Mảnh UI: nút, ô nhập
│   └── ...
├── be/                    # Backend (NestJS) — logic + xử lý
│   ├── src/
│   │   ├── ai-chat/       # Chat hỏi/đáp
│   │   ├── auth/          # Đăng nhập, JWT
│   │   ├── documents/     # Thu thập web, xử lý tài liệu
│   │   ├── uploads/       # API upload file
│   │   ├── vector/        # Embedding · tích hợp vector store
│   │   ├── queues/        # Hàng BullMQ
│   │   └── workers/       # Xử lý nền
│   ├── prisma/            # Schema DB, migration
│   ├── uploads/           # (Khi chạy) chỗ tích luỹ file
│   └── docker-compose.yml # PostgreSQL, Redis, Qdrant, Tika …
├── docs/                  # Tài liệu (file bạn đang đọc)
└── README.md              # Hướng dẫn ngắn (nếu có)
```

| Thư mục / file | Một dòng |
|----------------|----------|
| `fe/app` | **Địa chỉ URL** ↔ **trang hiển thị** |
| `be/src` | **API và quy tắc nghiệp vụ** |
| `be/prisma` | **Bản thiết kế bảng** |
| `be/uploads` hoặc đường upload | **Kho file** |
| `docker-compose` | Bật DB v.v. **một lệnh** |

---

## 6. API — Đơn hàng gửi ra ngoài cửa

**API** giống **phiếu gọi món nhà hàng**.  
Viết đúng form “món số 3, không kem” thì **bếp (server)** hiểu.

### Xác thực

| API | Làm gì? | Nói dễ |
|-----|---------|--------|
| `POST /auth/register` | Đăng ký | **Ghi tên vào danh sách** trường |
| `POST /auth/login` | Đăng nhập | Nhận **thẻ (token)** |
| `GET /auth/me` | Thông tin tôi | Xem **thẻ học sinh** |

**Ví dụ request (đăng nhập)**

```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "mật-khẩu"
}
```

**Ví dụ response**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "...", "email": "...", "role": "USER" }
}
```

### Chat (cần đăng nhập)

| API | Làm gì? |
|-----|---------|
| `POST /ai-chat/ask` | Hỏi → trả lời RAG + lưu hội thoại |
| `POST /ai-chat/search` | Chỉ search (không sinh đáp án) |
| `GET /ai-chat/my-conversations` | Danh sách hội thoại của tôi |
| `GET /ai-chat/my-conversations/:id` | Toàn bộ tin trong một hội thoại |

**Ví dụ (`ask`)**

```json
POST /ai-chat/ask
Authorization: Bearer <token>

{
  "question": "Theo quy định nghỉ phép, nghỉ năm bao nhiêu ngày?",
  "conversationId": "(tuỳ chọn) tiếp nối hội thoại cũ"
}
```

**Trong response có thể có**

```json
{
  "conversationId": "clx...",
  "answer": "...(trả lời markdown)...",
  "retrieved": [ { "content": "...", "score": 0.82 } ],
  "urlIngest": { "ingested": true, "url": "https://..." }
}
```

> Gửi **một dòng chỉ URL** trong chat — dự án có thể **học URL đó rồi** mới trả lời.

### Tài liệu · upload (gắn với luồng admin)

| API | Làm gì? |
|-----|---------|
| `POST /uploads/document` v.v. | Upload file · tạo bản ghi tài liệu |
| `POST /documents/from-web` | Học một trang URL (hoặc cả site tuỳ option) |
| `POST /documents/discover-web` | **Danh sách link** cùng site để khám phá |
| `GET /documents` | Danh sách tài liệu |

(Chi tiết body xem DTO trong controller.)

### Nguồn tri thức admin

| API | Làm gì? |
|-----|---------|
| `GET/POST /admin/knowledge-source/config` | Cấu hình kết nối DB ngoài |
| `POST /admin/knowledge-source/sync` | Đồng bộ / học nội dung DB |

---

## 7. Cơ sở dữ liệu — Lưu những gì?

### Vì sao cần DB?

Tắt trình duyệt vẫn phải **giữ** user, tài liệu, chat — nên ghi vào **bảng trên server/cloud**.

### Bảng chính — giải thích dễ

| Tên bảng | Chứa gì | Ví dụ |
|-----------|---------|--------|
| **User** | Email, mật khẩu (hash), vai trò USER/ADMIN | **Danh sách học sinh · giáo viên** |
| **Document** | Tiêu đề, đường file, trạng thái (chờ/xong/lỗi), người upload | **Sổ đăng ký sách thư viện** |
| **DocumentChunk** | Mảnh chữ đã cắt, id vector, v.v. | **Thẻ từng đoạn trong sách** |
| **Conversation** | Tiêu đề phòng chat, user nào | **Tập giấy nhận tin** |
| **Message** | Lời user / lời AI | **Nội dung tin nhắn** |
| **ProcessingJob** | Tài liệu đang bước nào | **Bảng tiến độ** |
| **KnowledgeSourceConfig** | Địa chỉ DB ngoài, tên bảng | **Sổ liên lạc thư viện khác** |

**Dãy số embedding** thường nằm phía **Vector DB**; PostgreSQL giữ **nội dung mảnh · vectorId** để nối.

---

## 8. RAG — Giống như tìm sách trong thư viện

### RAG là gì?

**R**etrieval = tìm về, **A**ugmented = bổ sung, **G**eneration = sinh ra.  
Tức **chữ tìm được + câu hỏi** → viết đáp án.

### Khác gì chỉ dùng ChatGPT thuần?

| | ChatGPT thường | Dịch vụ có RAG của chúng ta |
|---|----------------|------------------------------|
| Dữ liệu học | Gần như toàn Internet (ước lượng) | Chủ yếu **tài liệu & web ta đưa vào** |
| Quy định nội bộ mới | Có thể không biết | Đưa vào thì **có thể biết** |
| Bịa chuyện | Đôi khi có | Có tài liệu thì **giảm** |

### Vì sao cần?

Quy định công ty, manual riêng team **không có trên Google công khai**. RAG như **mở “sách giáo khoa” đúng phần** trước khi trả lời.

### Ưu / nhược / khi nào dùng

| Ưu | Nhược |
|----|--------|
| Sát sự thật hơn | Cần chuẩn bị & quản lý chất lượng tài liệu |
| Có thể trích mảnh nguồn | Không có tài liệu thì đáp yếu |

**Khi nào?** Tài liệu nội bộ, hỗ trợ khách, thông báo site — chỗ **chữ của riêng mình** là quan trọng.

### Một dòng ví dụ

**Trong thư viện chỉ mở đúng trang có chữ “khủng long” rồi trả lời câu hỏi.**

---

## 9. Cách chạy — Làm theo từng bước

### 0) Chuẩn bị

- Cài **Node.js** + **pnpm**  
- **Docker Desktop** (để bật DB dễ)

### 1) Clone repo

```bash
git clone <địa-chỉ-repo>
cd Rag-tutorial
```

### 2) Docker: PostgreSQL · Redis · Qdrant · Tika

```bash
cd be
docker compose up -d
```

- PostgreSQL: ví dụ `localhost:5433` (xem map cổng trong compose)
- Redis: `6379`
- Qdrant: `6333`
- Tika: `9998`

### 3) Backend

Trong `be/.env` ghi **DATABASE_URL**, **JWT_SECRET**, **OpenAI API key**, khi cần **REDIS**, **VECTOR_STORE**, v.v.  
(Đừng commit `.env`!)

Ví dụ (sửa theo máy bạn):

```env
DATABASE_URL="postgresql://admin:123456@localhost:5433/myapp"
JWT_SECRET="chuỗi-dài-ngẫu-nhiên"
OPENAI_API_KEY="sk-..."
PORT=3002
REDIS_URL="redis://localhost:6379"
VECTOR_STORE=pgvector
```

Prisma:

```bash
cd be
pnpm install
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

Mở `http://localhost:3002` để kiểm tra health (nếu có).

### 4) Frontend

```bash
cd fe
pnpm install
cp .env.example .env.local
# Trong .env.local: NEXT_PUBLIC_API_BASE_URL=http://localhost:3002
pnpm run dev
```

Port mặc định thường **3003** (`next dev -p 3003` trong `package.json`).

### 5) Thử nhanh

1. `http://localhost:3003`  
2. Đăng ký / đăng nhập (seed có thể có admin — xem file seed)  
3. `/chat` hỏi thử  
4. `/admin` upload tài liệu (khi là admin)

---

## 10. Lỗi thường gặp & cách xử lý

| Triệu chứng | Nguyên nhân hay gặp | Gợi ý |
|-------------|---------------------|-------|
| Lỗi `OPENAI` | Thiếu key · hết hạn · vượt hạn mức | Kiểm tra `.env`, bảng điều khiển OpenAI |
| Không kết nối DB | Docker chưa chạy, sai port/mật khẩu | `docker compose ps`, kiểm tra `DATABASE_URL` |
| Lỗi CORS / mạng | FE và API lệch địa chỉ | `NEXT_PUBLIC_API_BASE_URL` trùng backend? |
| Chunk quá to / nhỏ | Cấu hình · loại file | Chỉnh kích thước chunk & overlap |
| Lo chi phí embedding | Nhiều câu hỏi & tài liệu | Giảm topK, cache, model nhỏ hơn |
| Lỗi HWP | Container Tika tắt | Chạy `tika` trong Docker, kiểm tra `TIKA_URL` |
| Vector trống | Chưa học xong | Trạng thái document đã COMPLETED chưa |

---

## 11. Khi muốn phát triển dịch vụ sau này

**Ví dụ**: Lúc đầu như **một lớp**; sau nhiều lớp thì phải nới **nhà ăn · hành lang**.

| Chủ đề | Nói dễ |
|--------|--------|
| **Tách server** | Server chat riêng, server xử lý file riêng — **phòng chức năng khác nhau** |
| **Load balancing** | Chia khách sang nhiều quầy — **nhiều cửa giao dịch ngân hàng** |
| **Queue** | Việc nặng xếp hàng làm dần — hướng BullMQ |
| **CDN** | Ảnh/JS nhân bản khắp nơi — **kho cache gần user** |
| **Cache** | Câu hay hỏi ghi sẵn — dùng Redis v.v. |

**Đi sâu hơn** (đồng thời, chi phí tháng, bottleneck, scale-out có số): xem [mục 12](#12-hướng-dẫn-hiệu-năng-và-xử-lý-traffic-chi-phí--mở-rộng--vận-hành).

---

## 12. Hướng dẫn hiệu năng và xử lý traffic (chi phí · mở rộng · vận hành)

> Từ mục này trở đi vừa dùng **ẩn dụ dễ** vừa gợi **con số vận hành**.  
> **Chi phí · đồng thời · thời gian đáp** đều là **ước lượng theo giả định**; thay đổi theo region, hợp đồng, model, cache, quota. Trước quyết định quan trọng hãy dùng máy tính giá cloud và [bảng giá OpenAI](https://openai.com/api/pricing/).

### Nội dung mục

| STT | Chủ đề |
|-----|--------|
| 12.1 | Hiện năng & bottleneck (theo mono repo này) |
| 12.2 | **Chi phí tháng**: server · lưu trữ · CDN |
| 12.3 | **Token & giá OpenAI** (ví tiện lợi · taxi) |
| 12.4 | Gợi ý **cấu hình server** theo tình huống |
| 12.5 | Bottleneck |
| 12.6 | Scale-out (thêm máy) |
| 12.7 | Chiến lược tối ưu |
| 12.8 | Vấn đề vận hành hay gặp |
| 12.9 | Kiến trúc vận hành gợi ý (Việt Nam · Hàn Quốc) |

---

### 12.1 Phân tích hiệu năng dự án (theo cấu trúc)

**Stack repo**: Next.js `fe/` · NestJS `be/` · PostgreSQL · Redis (+ BullMQ) · vector (Qdrant hoặc pgvector) · OpenAI API · Docker Compose (DB, Redis, Qdrant, Tika…) · file gốc trên đĩa `uploads/` v.v.

#### Làm rõ “đồng thời”

| Cách gọi | Nghĩa |
|----------|--------|
| **Đồng thời (web)** | Số người mở site — chủ yếu login, list, tĩnh — thường **nhẹ** |
| **Đồng thời câu RAG** | Số request cùng lúc chạy backend + OpenAI + vector — **đây là phần nặng** |
| **Đồng thời upload · học** | Admin upload PDF, hàng **embedding** chạy — tốn **CPU · đĩa · TPM embedding OpenAI** |

**Một dòng**: Khi nói “1–2 server” với dự án này, thường **OpenAI · kết nối DB · pipeline tài liệu** chạm trần **trước** Nest/Next.

#### Khoảng bao nhiêu người? (vì sao con số đó)

Giả định **một host Docker** chạy chung Postgres · Redis · Qdrant · Nest · (dev có thể có Next). “10 · 100” hiểu gần với **số câu hỏi RAG đang chờ đáp cùng lúc**.

| Đồng thời câu RAG (chồng lấn) | Cảm giác | Vì sao ước vậy? |
|--------------------------------|----------|-----------------|
| **~10** | **Ổn đa số** (đôi khi chậm) | Một câu thường **vài giây**; queue/ pool ổn thì hay xử lý **trước khi chạm quota** |
| **~100** | **Tùy thiết kế** | **RPM/TPM** OpenAI, connection Postgres, `topK`, độ dài chunk → **hàng đợi** |
| **~1,000** | **Một API server** thường khó | Hàng nghìn gọi **API ngoài vài giây** cùng lúc cần **scale ngang · rate limit · cache** |
| **~10,000** | **Kiến trúc production** | Region, multi-AZ, autoscale, quan sát, tách DB/vector, gateway là mặc định |

**CPU / RAM (một host Docker bật nhiều thứ)**

| Cấu hình | CPU | RAM | Ghi chú |
|----------|-----|-----|---------|
| Tối thiểu (học) | 2 vCPU | **8 GB** | 4 GB chung Postgres+Qdrant+Redis thường **chật** |
| Nên (local · nhỏ) | 4 vCPU | **16 GB** | File lớn Tika hoặc Qdrant cần RAM dư |
| Traffic nhỏ thật | 4–8 vCPU | **16–32 GB** | Lúc cân nhắc tách worker upload/embedding |

**Khi upload nhiều**

| Ảnh hưởng | Mô tả |
|-----------|--------|
| Đĩa · CPU | Parse Tika · (tuỳ) OCR · số trang PDF → **vài giây ~ vài chục giây / job** |
| Tắc queue | Một hàng BullMQ → upload phía sau **“đang chờ”** — tăng worker / tách instance |
| Chi phí embedding · TPM | Nhiều chunk → nhiều **gọi API & token** |

**Tốc độ đáp AI (người dùng cảm nhận)**

| Đoạn | Khoảng | Ghi chú |
|------|---------|---------|
| Vector search (topK nhỏ) | **10–100 ms** | Tùy dữ liệu · index · filter |
| Tới “token đầu” OpenAI (stream) | **0,5–4 s** | Model · tắc nghẽn · độ dài prompt |
| Cả câu trả lời ngắn | **2–10 s** | Context dài → input token & thời gian ↑ |

#### Quy mô nhỏ · trung · lớn — hay hỏng chỗ nào, chuẩn bị gì

| Quy mô (cảm giác đồng thời RAG) | Triệu chứng | Server · cấu trúc | Hướng tối ưu |
|----------------------------------|-------------|-------------------|--------------|
| **Nhỏ (~10–30)** | Đôi khi chậm, DB dev nặng | **1–2 máy**, Compose hoặc VPC nhỏ | Chunk · `topK` · pool, **gpt-4o-mini**, streaming |
| **Trung (~30–300)** | 429, p95 tăng, hết connection DB | **Nhiều API + LB**, cân nhắc tách Redis/DB | Cache, queue, PgBouncer, tách worker upload |
| **Lớn (hàng trăm RAG đồng thời+)** | Sập nhiều lớp, chi phí tăng vọt | **Multi-AZ**, read replica, tách vector & object storage, **rate limit** | Gộp câu giống nhau, cache FAQ, embed theo lô, cảnh báo chi phí |

---

### 12.2 Chi phí server (ước lượng)

Số tiền là **thị trường đại khái**. **VND** nhân thô khoảng **25.000 ₫/USD** (chưa thuế / ưu đãi / tỷ giá thực).

#### “Chi phí tháng” theo hạng mục

| Hạng mục | Tháng (đại khái, một region, quy mô nhỏ) | Mô tả |
|----------|------------------------------------------|--------|
| **VPS** | **~$25–120** (khoảng **630k–3.000k ₫**) | 2–8 vCPU / 8–32G — Hetzner, DO, hosting trong nước, v.v. |
| **AWS EC2+EBS+…** | **~$100–400+** | NAT, ALB, backup, monitor là tăng nhanh |
| **Máy GPU** | **~$400–3.000+** | **Dự án mặc định gọi OpenAI** → app server **không bắt buộc** GPU. Chỉ khi tự host Llama v.v. |
| **OpenAI** | **Theo dùng** | Bảng 12.3 — thường **LLM + embedding** biến thiên nhất |
| **Vector DB** | **Qdrant tự host: gộp VPS** ~ **managed $50–400+** | Tùy kích collection · QPS |
| **Lưu trữ (S3 v.v.)** | **Vài trăm nghìn ₫ trở lên** | PDF gốc · backup · log — theo dung lượng & traffic tải |
| **Redis** | **$0 gộp** ~ **managed $25–150** | Chỉ cache thì nhỏ; cluster thì tăng |
| **CDN** | **~$5–80+** | Tĩnh & response cache được — theo traffic |

#### Chi phí OpenAI theo số user · câu · tài liệu (ví dụ)

**Giả định A — chi phí câu hỏi**

- Model: **gpt-4o-mini** (mức tương đương)  
- Ví dụ giá công khai (có thể đổi): **input $0,15 / 1M tok**, **output $0,60 / 1M tok**  
- 1 câu: **2.000 tok input** (system + chunk tìm được + câu hỏi) + **800 tok output**  
- 1 lần LLM ≈ `(2000×0,15 + 800×0,6) / 1.000.000` ≈ **$0,00078** (dưới **~20 ₫** nếu nhân đại khái 25k ₫/USD)

| Câu hỏi / ngày | Câu / tháng (30 ngày) | Chỉ LLM (ước) |
|----------------|------------------------|----------------|
| 100 | 3.000 | ~ **$2,3** |
| 1.000 | 30.000 | ~ **$23** |
| 10.000 | 300.000 | ~ **$234** |
| 100.000 | 3.000.000 | ~ **$2.340** |

**Giả định B — chi phí tài liệu (embedding)**

- `text-embedding-3-small` ví dụ **$0,02 / 1M tok**  
- 1 tài liệu **40 chunk × 400 tok** = **16.000 tok**  
- Chi phí embed ≈ 16.000 × 0,02 / 1.000.000 = **$0,00032 / tài liệu (một lần embed toàn bộ)**

| Số tài liệu | Chỉ embedding (giả sử không re-embed) |
|-------------|----------------------------------------|
| 100 | ~ **$0,032** |
| 1.000 | ~ **$0,32** |
| 10.000 | ~ **$3,2** |

→ **Câu hỏi càng nhiều chi phí tăng càng nhanh** so với **một lần nhét tài liệu** (trừ khi re-chunk / re-process liên tục).

---

### 12.3 Cấu trúc giá OpenAI (tiện lợi · taxi)

| Khái niệm | Một dòng | Ví dụ dễ |
|-----------|----------|----------|
| **Token** | Đơn vị **mảnh câu** AI đọc/viết | **Quét từng mã vạch ở quầy** — câu dài token nhiều |
| **Input token** | Chữ **đi vào** model (câu hỏi + tài liệu ghép) | Taxi: **đoạn đầu lên mét** |
| **Output token** | **Câu trả lời mới** model sinh | **Đi thêm bao xa** mét nhảy — dài là đắt |
| **Giá embedding** | Đổi chữ thành **vector để search** | Dán **nhãn màu lên gáy sách** — một lần rồi tìm nhanh trên giá |

| Ví dụ | Giả định | Ước |
|-------|----------|-----|
| Upload 1 tài liệu (embed) | 16k tok | Xem bảng 12.2 |
| 1 câu hỏi | input 2k + output 800 (mini) | ~ **$0,00078** |
| 1 triệu câu / tháng (cùng giả định) | scale | ~ **$780** (chỉ LLM, không cache) |

---

### 12.4 Gợi ý cấu hình server

| Tình huống | CPU | RAM | Ổ | Mạng | Số máy (điểm xuất phát) |
|------------|-----|-----|---|------|-------------------------|
| **Cá nhân · tối thiểu** | 2 vCPU | 8 GB | SSD **100 GB** | Nhà / văn phòng | **1** |
| **Cá nhân · nên** | 4 vCPU | 16 GB | SSD **200 GB** | Như trên | **1** |
| **Startup đầu (vài chục–vài trăm user hoạt động)** | API 4–8 vCPU | 16–32 GB | **≥300 GB** | Sau LB **≥100 Mbps** | **2** (dự phòng API + cân nhắc tách DB) |
| **Trung bình (hàng trăm chat đồng thời)** | Tách **API · DB · vector** | DB & vector RAM dư | NVMe nên dùng | DC | **3–12+** |
| **AI quy mô lớn (MAU trăm nghìn)** | Pool riêng · autoscale | Sharding · read replica | Object + SSD local | Multi-region | **Hàng chục+** |

---

### 12.5 Bottleneck (điểm nghẽn)

**Vì sao chậm?** Nếu việc đổ vào **vượt khả năng xử lý** sẽ có hàng đợi, kẹt ở **ống hẹp nhất**.

| Yếu tố | Mức rủi ro trong RAG này | Ghi nhớ |
|--------|--------------------------|---------|
| **OpenAI API** | Rất lớn | **RPM/TPM**, mạng, model bận |
| **Embedding** | Lớn khi upload ồ ạt | Số chunk = số gọi API & token |
| **Vector search** | Thường trung bình trở xuống | Data · filter · index lớn thì ↑ |
| **Upload file** | Có lúc rất lớn | Đĩa · ghi đồng thời · quét virus |
| **OCR** (nếu có) | Lớn | Chi phí & thời gian / trang |
| **PDF lớn** | Lớn | RAM · parse |

**Giảm nhẹ điển hình**

| Cách | Vai trò |
|------|---------|
| **Cache (Redis)** | Cùng câu + cùng tài liệu → **tái dùng đáp & kết quả search** |
| **Queue (BullMQ)** | Việc nặng **ra khỏi request web** — chỉ **nhận phiếu** nhanh |
| **CDN** | JS/CSS/ảnh **gần user** |
| **Load balancer** | Nhiều **cửa API** chia tải |

---

### 12.6 Scale-out (nhà hàng · bưu điện · ngân hàng)

| Ẩn dụ | Ứng với dự án |
|--------|----------------|
| **Bếp nhà hàng** | Chỉ xếp hàng FE không đủ — **bếp (BE · worker)** phải theo. AI như **bếp món đặc biệt** — đông khách cần **số thứ tự (queue)** |
| **Kho bưu điện** | Upload · embed = **nhập hàng**; trả lời = **xuất** — tách trung tâm thì một bên tắc bên kia vẫn chạy |
| **Quầy ngân hàng** | LB = **lấy số** — thêm quầy (instance API) chia luồng |

**Doanh nghiệp thường làm**

| Tách | Lý do |
|------|--------|
| **Frontend** | Tĩnh · SSR · gần edge (Vercel v.v.) |
| **Backend API** | Scale ngang theo request |
| **AI worker** | Embed · job dài **không chiếm** thread HTTP |
| **DB / Vector DB** | Tách **OS** chia CPU · RAM · đĩa |
| **Queue** | Traffic **giật cục** vẫn **không mất** — xử lý sau |

---

### 12.7 Chiến lược tối ưu hiệu năng

| Chiến lược | Vì sao nhanh hơn? | Cảm nhận · chi phí (ước) |
|------------|-------------------|---------------------------|
| **Redis cache** | Lặp cùng query → **bớt gọi ngoài** | p95 vài giây → có thể **vài chục ms** (hit) |
| **Response streaming** | Giảm chờ đến **chữ đầu** | User ít ngột ngạt |
| **Tối ưu chunk** | Không nhét context dài vô ích | **Token & độ trễ** cùng giảm |
| **Tái dùng embedding** | Hash file / version giống → không tính lại | Giảm mạnh chi phí upload |
| **Lazy loading** | Chỉ tải dữ liệu cần lúc đầu | FE load nhanh hơn |
| **CDN** | POP gần địa lý | RTT tĩnh ↓ |
| **Pagination** | Giới hạn số dòng mỗi lần | Bảo vệ DB & RAM |
| **Worker nền · queue** | UI **chỉ tiếp nhận** | Upload ồ ạt ít làm **đứng cả dịch vụ** |

---

### 12.8 Vấn đề có thể gặp khi chạy thật

| Vấn đề | Ứng phó | Monitor · log |
|--------|---------|----------------|
| OpenAI lỗi / chậm | Retry · exponential backoff, **tin ngắn**, cache | HTTP `429/5xx`, trạng thái OpenAI |
| Traffic giật | Rate limit, queue, autoscale, **WAF** | RPS, p95/p99, độ dài queue |
| DB chết / hết connection | Replica · failover, PgBouncer, pool | “too many connections”, slow query |
| Redis hết RAM | `maxmemory-policy`, TTL, giới hạn cache | `used_memory`, số key |
| PDF quá lớn | Giới hạn upload, chia trang, async | Thời gian worker · OOM |
| OCR chậm | Async · engine riêng · giới hạn trang | Wall time từng job |
| Upload đồng loạt | Quota user/IP, **backpressure** | Hàng BullMQ · tỷ lệ lỗi |

---

### 12.9 Kiến trúc vận hành gợi ý

| Mục tiêu | Hình ảnh thực tế |
|----------|------------------|
| **PoC · nội bộ với repo này** | **Một host Docker** hoặc **VPS nhỏ**, vector chọn **pgvector** hoặc **Qdrant**, LLM & embed ưu tiên **model nhỏ** |
| **Hiệu quả chi phí (dịch vụ nhỏ)** | FE **CDN/edge**, BE **≥2 + LB**, DB & Redis **ít nhất một lần dùng managed hoặc instance riêng**, **cảnh báo** OpenAI & storage |
| **Startup (gợi ý)** | User **Hàn** nhiều → ưu tiên **region Seoul**; log · metric · alert tối thiểu (CPU, RAM, đĩa, 5xx, queue, chi phí ngày) |
| **User Việt Nam nhiều** | Giảm RTT: đặt API **region gần** (ví dụ **Singapore**), cần thì **multi-region** — **pháp lý & dữ liệu cá nhân** xem riêng |

**Tóm lại**: Mono repo đã có **tách vai trò (queue · module)** khá sẵn; traffic tăng thì nghi **OpenAI quota → kết nối & query DB → worker & storage** theo thứ tự đó sẽ vận hành dễ hơn.

---

## 13. Tóm lại

### Một dòng lõi

**“Nhét sách (tài liệu) của riêng ta vào thư viện; hỏi thì AI chỉ xem chỗ quanh sách đó rồi trả lời.”**

### Học được gì từ dự án

- Web **frontend · backend** nói chuyện thế nào (HTTP, JSON)  
- **DB** lưu những gì  
- **RAG**: giảm bịa + bám dữ liệu của mình  
- **Docker** bật DB, queue… cùng lúc  

### Có thể mở rộng kiểu dịch vụ gì?

Q&A **nội quy**, **chatbot manual sản phẩm**, **hỗ trợ khách**, **gia sư tài liệu đào tạo**, v.v.

---

## Lời kết

Lần đầu dev cũng không sao.  
Đọc xong file này, **thử bật server một lần** cũng đã là bước lớn.  
Kẹt thì **copy nguyên dòng lỗi lên Google** — thường đã có người đi qua. Cố lên nhé!
