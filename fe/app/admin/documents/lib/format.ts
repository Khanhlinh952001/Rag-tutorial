import { STEP_LABELS } from "./constants";
import type { FilterKey } from "./types.js";

export function emptyMessage(filter: FilterKey): string {
  switch (filter) {
    case "COMPLETED":
      return "AI가 학습한 문서가 아직 없습니다.";
    case "PROCESSING":
      return "현재 학습 중인 문서가 없습니다.";
    case "PENDING":
      return "대기 중인 문서가 없습니다.";
    case "FAILED":
      return "실패한 문서가 없습니다.";
    default:
      return "업로드된 문서가 없습니다. 위에서 파일을 업로드해 주세요.";
  }
}

export function translateStep(step?: string | null): string | null {
  if (!step) return null;
  return STEP_LABELS[step] ?? step;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatStableDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatRelativeTime(iso: string): string {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return "-";
  const diff = Date.now() - created;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return formatStableDate(iso);
}

export function shortMime(mimeType: string): string {
  if (!mimeType) return "-";
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "text/plain": "TXT",
    "text/markdown": "MD",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/vnd.ms-powerpoint": "PPT",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PPTX",
    "application/x-hwp": "HWP",
    "application/haansofthwp": "HWP",
    "application/vnd.hancom.hwp": "HWP",
    "application/x-hwpx": "HWPX",
    "application/vnd.hancom.hwpx": "HWPX",
    "text/html": "WEB",
  };
  if (map[mimeType]) return map[mimeType];
  const subtype = mimeType.split("/")[1] ?? mimeType;
  return subtype.toUpperCase().slice(0, 6);
}

export function stringifyPreviewCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
