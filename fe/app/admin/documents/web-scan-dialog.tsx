"use client";

import { Globe, Loader, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { DiscoverWebResponse } from "./lib/types";

export type WebScanDialogProps = {
  discoverLoading: boolean;
  webConfirmLoading: boolean;
  devWebUrl: string;
  setDevWebUrl: (v: string) => void;
  devWebTitle: string;
  setDevWebTitle: (v: string) => void;
  discoverMaxPages: string;
  setDiscoverMaxPages: (v: string) => void;
  discoverResult: DiscoverWebResponse | null;
  selectedPageUrls: Set<string>;
  webPreviewError: string | null;
  onClose: () => void;
  onRunDiscover: () => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onConfirmIngest: () => void;
  onTogglePage: (url: string, checked: boolean) => void;
};

export function WebScanDialog({
  discoverLoading,
  webConfirmLoading,
  devWebUrl,
  setDevWebUrl,
  devWebTitle,
  setDevWebTitle,
  discoverMaxPages,
  setDiscoverMaxPages,
  discoverResult,
  selectedPageUrls,
  webPreviewError,
  onClose,
  onRunDiscover,
  onSelectAll,
  onClearAll,
  onConfirmIngest,
  onTogglePage,
}: WebScanDialogProps) {
  const busy = discoverLoading || webConfirmLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="웹 사이트 페이지 선택"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-[1px]"
        aria-label="닫기"
        onClick={onClose}
        disabled={busy}
      />
      <section className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-emerald-500/30 bg-card shadow-xl dark:bg-emerald-950/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,oklch(0.55_0.12_160/0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,oklch(0.45_0.15_160/0.15),transparent)]"
        />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                웹 사이트 · 스캔 후 페이지 선택
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                「페이지 스캔」으로 같은 도메인의 링크를 따라 발견한 페이지 목록을 불러온
                뒤, 학습할 페이지만 체크하고「선택 페이지 학습」을 누르세요.
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

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-xs">
                <span className="text-muted-foreground">시작 URL</span>
                <Input
                  type="url"
                  inputMode="url"
                  value={devWebUrl}
                  onChange={(e) => {
                    setDevWebUrl(e.target.value);
                  }}
                  placeholder="https://example.com/"
                  disabled={busy}
                />
              </label>
              <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-xs">
                <span className="text-muted-foreground">문서 제목 (선택)</span>
                <Input
                  value={devWebTitle}
                  onChange={(e) => setDevWebTitle(e.target.value)}
                  placeholder="비우면 호스트명 사용"
                  disabled={busy}
                />
              </label>
              <label className="flex min-w-[120px] flex-col gap-1.5 text-xs sm:max-w-[140px]">
                <span className="text-muted-foreground">스캔 상한(페이지)</span>
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  value={discoverMaxPages}
                  onChange={(e) => setDiscoverMaxPages(e.target.value)}
                  placeholder="기본값"
                  disabled={busy}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !devWebUrl.trim()}
                onClick={onRunDiscover}
              >
                {discoverLoading ? (
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                페이지 스캔
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!discoverResult || busy}
                onClick={onSelectAll}
              >
                전체 선택
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!discoverResult || busy}
                onClick={onClearAll}
              >
                전체 해제
              </Button>
              <Button
                type="button"
                size="sm"
                className="ml-auto sm:ml-0"
                disabled={
                  webConfirmLoading ||
                  discoverLoading ||
                  !discoverResult ||
                  selectedPageUrls.size === 0 ||
                  !devWebUrl.trim()
                }
                onClick={onConfirmIngest}
              >
                {webConfirmLoading ? (
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                선택 페이지 학습 ({selectedPageUrls.size})
              </Button>
            </div>
          </div>

          {webPreviewError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {webPreviewError}
            </p>
          ) : null}

          {discoverResult ? (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="break-all">시작: {discoverResult.seedUrl}</span>
                <span className="tabular-nums">
                  발견 {discoverResult.pages.length}페이지 · 스캔 상한{" "}
                  {discoverResult.maxFetches}회
                </span>
                {discoverResult.stoppedEarly ? (
                  <span className="text-amber-800 dark:text-amber-400">
                    (상한 도달, 남은 링크 있음)
                  </span>
                ) : null}
              </div>
              <div className="max-h-[min(52vh,32rem)] space-y-1.5 overflow-y-auto rounded-lg border border-emerald-500/25 bg-muted/30 p-2 dark:bg-background/40">
                {discoverResult.pages.map((p) => (
                  <label
                    key={p.url}
                    className="flex cursor-pointer gap-2 rounded-md border border-border/60 bg-background/90 px-2 py-2 text-[11px] hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={selectedPageUrls.has(p.url)}
                      onChange={(e) => onTogglePage(p.url, e.target.checked)}
                      disabled={busy}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="break-all font-medium text-foreground">
                        {p.url}
                      </span>
                      {p.pageTitle ? (
                        <span className="mt-0.5 block text-muted-foreground">
                          {p.pageTitle}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block tabular-nums text-muted-foreground">
                        {p.charCount.toLocaleString()}자
                        {!p.hasText ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {" "}
                            · 본문 없음
                          </span>
                        ) : null}
                      </span>
                      {p.textPreview ? (
                        <p className="mt-1 line-clamp-2 font-mono text-[10px] text-muted-foreground">
                          {p.textPreview}
                        </p>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
