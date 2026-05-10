"use client";

import {
  CircleCheck,
  Clock,
  Database,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatRelativeTime } from "./lib/format";
import type { KnowledgeDbType, KnowledgeSyncSummary } from "./lib/types";

export function KnowledgeSourceCard({
  sourceName,
  dbType,
  knowledgeSyncSummary,
  retraining,
  onOpenConfig,
  onRetrain,
  onDelete,
}: {
  sourceName: string;
  dbType: KnowledgeDbType;
  knowledgeSyncSummary: KnowledgeSyncSummary | null;
  retraining: boolean;
  onOpenConfig: () => void;
  onRetrain: () => void;
  onDelete: () => void;
}) {
  const learned = Boolean(knowledgeSyncSummary);
  const cardTone = learned
    ? "border-emerald-500/40 border-dashed bg-emerald-500/5 hover:border-emerald-500/60"
    : "border-border border-dashed hover:border-foreground/30";
  const iconTone = learned
    ? "text-emerald-600 dark:text-emerald-400"
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
          aria-label="재학습"
          onClick={onRetrain}
          disabled={retraining}
          className="bg-background/80 backdrop-blur"
        >
          <RefreshCw
            className={cn("h-3 w-3", retraining && "animate-spin")}
          />
        </Button>
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
      <button
        type="button"
        className="flex h-full flex-col gap-3 text-left"
        onClick={onOpenConfig}
      >
        <div className="flex items-center justify-between">
          <div className="relative">
            <Database className={cn("h-12 w-12", iconTone)} />
            {learned ? (
              <span className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <CircleCheck className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
                <Clock className="h-3 w-3" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded bg-background/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
              DB
            </span>
            <span className="rounded bg-background/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
              {dbType}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{sourceName}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            최근 학습:{" "}
            {knowledgeSyncSummary
              ? formatRelativeTime(knowledgeSyncSummary.syncedAt)
              : "-"}
          </p>
        </div>
        <div className="mt-auto">
          {knowledgeSyncSummary ? (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              <span>AI 학습 완료</span>
              <span className="ml-auto tabular-nums opacity-80">
                {knowledgeSyncSummary.indexed} 청크
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>미학습</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
