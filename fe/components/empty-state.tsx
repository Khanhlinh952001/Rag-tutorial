import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  message,
  loading,
  className,
  compact,
}: {
  icon?: LucideIcon;
  message: string;
  loading?: boolean;
  className?: string;
  /** 테이블 셀 등 좁은 영역 */
  compact?: boolean;
}) {
  const size = compact ? "h-8 w-8" : "h-11 w-11";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 text-center text-muted-foreground",
        compact ? "py-4" : "py-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {loading ? (
        <Loader2
          className={cn(size, "animate-spin text-muted-foreground")}
          aria-hidden
        />
      ) : Icon ? (
        <Icon
          className={cn(size, "shrink-0 opacity-75")}
          strokeWidth={1.35}
          aria-hidden
        />
      ) : null}
      <p className={cn("max-w-md leading-snug", compact ? "text-xs" : "text-sm")}>
        {message}
      </p>
    </div>
  );
}
