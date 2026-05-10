"use client";

import {
  BrainCircuit,
  CircleAlert,
  CircleCheck,
  Clock,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Globe,
  Loader,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  formatFileSize,
  formatRelativeTime,
  formatStableDate,
  shortMime,
  translateStep,
} from "./lib/format";
import type { DocumentItem } from "./lib/types";

function FileTypeIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  if (mimeType === "text/html") {
    return <Globe className={className} strokeWidth={1.4} />;
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className={className} strokeWidth={1.4} />;
  }
  if (
    mimeType === "application/json" ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript")
  ) {
    return <FileCode className={className} strokeWidth={1.4} />;
  }
  if (
    mimeType === "text/csv" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel")
  ) {
    return <FileSpreadsheet className={className} strokeWidth={1.4} />;
  }
  if (mimeType === "application/pdf") {
    return <FileType className={className} strokeWidth={1.4} />;
  }
  return <FileText className={className} strokeWidth={1.4} />;
}

export function DocumentCard({
  doc,
  isHydrated,
  onDelete,
}: {
  doc: DocumentItem;
  isHydrated: boolean;
  onDelete: () => void;
}) {
  const job = doc.processingJobs?.[0];
  const chunks = doc.totalChunks ?? doc._count?.chunks ?? 0;
  const learned = doc.status === "COMPLETED";

  const cardTone =
    doc.status === "COMPLETED"
      ? "border-emerald-500/40 border-dashed bg-emerald-500/5 hover:border-emerald-500/60"
      : doc.status === "PROCESSING"
        ? "border-amber-500/40 border-dashed bg-amber-500/5 hover:border-amber-500/60"
        : doc.status === "FAILED"
          ? "border-destructive/40 border-dashed bg-destructive/5 hover:border-destructive/60"
          : "border-border border-dashed hover:border-foreground/30";

  const iconTone =
    doc.status === "COMPLETED"
      ? "text-emerald-600 dark:text-emerald-400"
      : doc.status === "PROCESSING"
        ? "text-amber-600 dark:text-amber-400"
        : doc.status === "FAILED"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-4 transition-colors",
        cardTone,
      )}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="삭제"
          onClick={onDelete}
          className="bg-background/80 text-destructive backdrop-blur"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative">
          <FileTypeIcon
            mimeType={doc.mimeType}
            className={cn("h-12 w-12", iconTone)}
          />
          {learned ? (
            <span className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <CircleCheck className="h-3.5 w-3.5" />
            </span>
          ) : doc.status === "PROCESSING" ? (
            <span className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Loader className="h-3 w-3 animate-spin" />
            </span>
          ) : doc.status === "FAILED" ? (
            <span className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm">
              <CircleAlert className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
              <Clock className="h-3 w-3" />
            </span>
          )}
        </div>
        <span className="rounded bg-background/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          {shortMime(doc.mimeType)}
        </span>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" title={doc.title}>
          {doc.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatFileSize(doc.fileSize)} ·{" "}
          {isHydrated
            ? formatRelativeTime(doc.createdAt)
            : formatStableDate(doc.createdAt)}
        </p>
      </div>

      <div className="mt-auto">
        {learned ? (
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-3 w-3" />
            <span>AI 학습 완료</span>
            <span className="ml-auto tabular-nums opacity-80">{chunks} 청크</span>
          </div>
        ) : doc.status === "PROCESSING" ? (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <BrainCircuit className="h-3 w-3" />
            <span>{translateStep(job?.currentStep) ?? "AI 학습 중..."}</span>
          </div>
        ) : doc.status === "PENDING" ? (
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>대기 중 · 학습 시작 대기</span>
          </div>
        ) : (
          <div
            className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] font-medium text-destructive"
            title={job?.errorMessage ?? undefined}
          >
            <CircleAlert className="mt-px h-3 w-3 shrink-0" />
            <span className="line-clamp-2">
              학습 실패{job?.errorMessage ? ` · ${job.errorMessage}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
