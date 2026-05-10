"use client";

import {
  BrainCircuit,
  CircleAlert,
  Clock,
  Inbox,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";

import { emptyMessage } from "./lib/format";
import type { FilterKey } from "./lib/types";

const ICON_BY_FILTER: Record<FilterKey, typeof Inbox> = {
  ALL: Inbox,
  COMPLETED: Sparkles,
  PROCESSING: BrainCircuit,
  PENDING: Clock,
  FAILED: CircleAlert,
};

export function DocumentListEmptyState({
  filter,
  loading,
}: {
  filter: FilterKey;
  loading: boolean;
}) {
  const Icon = ICON_BY_FILTER[filter] ?? Inbox;

  return (
    <EmptyState
      loading={loading}
      icon={Icon}
      message={loading ? "불러오는 중..." : emptyMessage(filter)}
    />
  );
}
