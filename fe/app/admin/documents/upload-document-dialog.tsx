"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type RefObject,
} from "react";
import { CircleAlert, CircleCheck, CloudUpload, FileText, Globe, Loader, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { UPLOAD_ACCEPT } from "./lib/constants";
import { formatFileSize } from "./lib/format";

export type UploadDocumentDialogProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  webIngesting: boolean;
  isDragging: boolean;
  selectedFiles: File[];
  webUrl: string;
  webTitle: string;
  error: string | null;
  info: string | null;
  /** false = 웹 URL 폼 표시 (동일 호스트 간단 학습) */
  showWebDevPanel: boolean;
  onClose: () => void;
  onUpload: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onIngestWeb: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  openFilePicker: () => void;
  clearSelectedFile: () => void;
  setWebUrl: (v: string) => void;
  setWebTitle: (v: string) => void;
};

export function UploadDocumentDialog({
  fileInputRef,
  uploading,
  webIngesting,
  isDragging,
  selectedFiles,
  webUrl,
  webTitle,
  error,
  info,
  showWebDevPanel,
  onClose,
  onUpload,
  onIngestWeb,
  onFileChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  openFilePicker,
  clearSelectedFile,
  setWebUrl,
  setWebTitle,
}: UploadDocumentDialogProps) {
  const busy = uploading || webIngesting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="새 문서 업로드"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-[1px]"
        aria-label="닫기"
        onClick={onClose}
        disabled={busy}
      />
      <section className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-dashed bg-card shadow-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.15_260/0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.2_260/0.18),transparent)]"
        />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                새 문서 추가하기
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                새 자료를 올리면 AI가 자동으로 학습합니다. 위 목록에서 진행 상황을
                확인하세요.
              </p>
              <p className="mt-2 overflow-x-auto whitespace-nowrap text-[11px] text-muted-foreground/90">
                API 파일 수신 <span aria-hidden>→</span> Queue에 작업 등록{" "}
                <span aria-hidden>→</span> Worker가 백그라운드 처리{" "}
                <span aria-hidden>→</span> 텍스트 추출 <span aria-hidden>→</span>{" "}
                청크 분할 <span aria-hidden>→</span> 임베딩 생성{" "}
                <span aria-hidden>→</span> 벡터 DB 저장
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              disabled={busy}
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form className="mt-6" onSubmit={onUpload}>
            <input
              id="admin-doc-upload"
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={onFileChange}
              disabled={busy}
              accept={UPLOAD_ACCEPT}
              multiple
            />

            <div
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => {
                if (!busy) openFilePicker();
              }}
              onKeyDown={(e) => {
                if (busy) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openFilePicker();
                }
              }}
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-label="파일 선택 또는 끌어다 놓기"
              className={cn(
                "relative flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[220px]",
                isDragging
                  ? "border-primary bg-primary/10 ring-2 ring-ring ring-offset-2 ring-offset-background"
                  : "cursor-pointer border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/35",
                busy ? "pointer-events-none cursor-default opacity-60" : "",
              )}
            >
              {uploading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/80 backdrop-blur-sm">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">업로드 중…</p>
                </div>
              ) : webIngesting ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/80 backdrop-blur-sm">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">웹 페이지 학습 중…</p>
                </div>
              ) : null}

              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-2xl border bg-background shadow-sm",
                  isDragging
                    ? "border-primary/50 text-primary"
                    : "text-muted-foreground",
                )}
              >
                <CloudUpload className="h-8 w-8" strokeWidth={1.5} />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {isDragging
                    ? "여기에 파일을 놓으세요"
                    : "여기에 드롭하거나 클릭하여 선택"}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word, PPT, TXT, Markdown, CSV, JSON, HWP, JPG, PNG, WEBP — 여러
                  파일 선택 가능
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {["PDF", "DOCX", "PPT", "PPTX", "TXT", "MD", "CSV", "JSON", "HWP", "JPG", "PNG", "WEBP"].map(
                  (ext) => (
                    <span
                      key={ext}
                      className="rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
                    >
                      {ext}
                    </span>
                  ),
                )}
              </div>
            </div>

            {selectedFiles.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
                  {selectedFiles.map((f) => (
                    <div
                      key={`${f.name}-${f.size}-${f.lastModified}`}
                      className="flex min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-background/80 px-3 py-2"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs font-medium" title={f.name}>
                          {f.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatFileSize(f.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    총 {selectedFiles.length}개 ·{" "}
                    {formatFileSize(
                      selectedFiles.reduce((sum, f) => sum + f.size, 0),
                    )}
                  </p>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={clearSelectedFile}
                    disabled={busy}
                    aria-label="선택 취소"
                  >
                    <X className="h-4 w-4" />
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="min-w-[120px]"
                  >
                    {uploading ? (
                      <>
                        <Loader className="h-3.5 w-3.5 animate-spin" />
                        전송 중
                      </>
                    ) : selectedFiles.length > 1 ? (
                      `AI에 보내기 (${selectedFiles.length})`
                    ) : (
                      "AI에 보내기"
                    )}
                  </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </form>

          {!showWebDevPanel ? (
            <>
              <div className="relative my-8 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  또는 웹 URL
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form className="space-y-3" onSubmit={onIngestWeb}>
                <label className="flex flex-col gap-1.5 text-xs">
                  <span className="text-muted-foreground">
                    페이지 URL (https)
                  </span>
                  <Input
                    type="url"
                    inputMode="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/docs"
                    disabled={busy}
                    autoComplete="url"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs">
                  <span className="text-muted-foreground">제목 (선택)</span>
                  <Input
                    value={webTitle}
                    onChange={(e) => setWebTitle(e.target.value)}
                    placeholder="비우면 페이지 제목 사용"
                    disabled={busy}
                  />
                </label>
                <Button
                  type="submit"
                  disabled={busy || !webUrl.trim()}
                  className="w-full sm:w-auto"
                >
                  {webIngesting ? (
                    <>
                      <Loader className="h-3.5 w-3.5 animate-spin" />
                      웹 페이지 학습 중…
                    </>
                  ) : (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      웹 페이지 학습
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : null}

          {error ? (
            <p
              className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              role="alert"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
          {info ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{info}</span>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
