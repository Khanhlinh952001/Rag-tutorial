import type { FilterKey, KnowledgeConfigForm } from "./types.js";

export const KNOWLEDGE_SUMMARY_STORAGE_KEY = "admin_knowledge_sync_summary";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3080";

/** 웹 스캔 UI 등 — NEXT_PUBLIC_WEB_DEV_PANEL=false 이면 숨김 (기본: 항상 표시) */
export const SHOW_WEB_DEV_PANEL =
  process.env.NEXT_PUBLIC_WEB_DEV_PANEL !== "false";

export const UPLOAD_ACCEPT =
  ".pdf,.txt,.md,.doc,.docx,.csv,.json,.hwp,.hwpx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,application/pdf,text/plain,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/x-hwp,application/haansofthwp,application/vnd.hancom.hwp,application/x-hwpx,application/vnd.hancom.hwpx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,image/webp,image/gif";

export const INITIAL_KNOWLEDGE_CONFIG: KnowledgeConfigForm = {
  sourceName: "",
  dbType: "POSTGRES",
  host: "",
  port: "5432",
  username: "",
  password: "",
  database: "",
  schema: "public",
  sqlitePath: "",
  tableName: "",
  idColumn: "id",
  contentColumn: "content",
  titleColumn: "title",
  whereClause: "",
};

export const FILTER_LABELS: Record<FilterKey, string> = {
  ALL: "전체",
  COMPLETED: "AI 학습 완료",
  PROCESSING: "학습 중",
  PENDING: "대기",
  FAILED: "실패",
};

export const STEP_LABELS: Record<string, string> = {
  uploaded: "업로드 완료",
  extracting: "텍스트 추출 중",
  "classifying-image": "이미지 유형 판별 중",
  "vision-caption": "Vision 캡션·태그 생성 중",
  "extracting-web": "웹 페이지 불러오는 중",
  cleaning: "텍스트 정리 중",
  chunking: "청크 분할 중",
  embedding: "임베딩 생성 중",
  indexing: "인덱싱 중",
  completed: "완료",
  failed: "실패",
};
