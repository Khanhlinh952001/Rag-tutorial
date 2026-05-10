"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  FileStack,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  UserRoundSearch,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

type DocumentItem = {
  id: string;
  status: string;
  totalChunks?: number | null;
};

type DocStatusKey = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

const DOC_STATUS_LABEL: Record<DocStatusKey, string> = {
  PENDING: "대기",
  PROCESSING: "학습 중",
  COMPLETED: "학습 완료",
  FAILED: "실패",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";

function readStoredUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("admin_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim().length > 0) return message;
  if (Array.isArray(message)) {
    const joined = message.filter((m) => typeof m === "string").join(", ");
    if (joined.length > 0) return joined;
  }
  return fallback;
}

export default function AdminDashboardPage() {
  const [user] = useState<AdminUser | null>(() => readStoredUser());
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setError("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setLoadingUsers(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data)) {
        setUsers(data as AdminUser[]);
      } else {
        setError(
          `사용자 목록 불러오기 실패 (HTTP ${response.status}): ${extractErrorMessage(
            data,
            "서버 오류",
          )}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    const token = localStorage.getItem("admin_access_token");
    if (!token) return;
    setLoadingDocuments(true);
    try {
      const response = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data)) {
        setDocuments(data as DocumentItem[]);
      }
    } catch {
      // soft-fail; dashboard stats only
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
    void loadDocuments();
  }, [loadUsers, loadDocuments]);

  const completedDocs = documents.filter((d) => d.status === "COMPLETED").length;

  const documentCounts = useMemo(() => {
    const counts: Record<DocStatusKey, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };
    for (const d of documents) {
      const k = d.status as DocStatusKey;
      if (k in counts) counts[k] += 1;
    }
    return counts;
  }, [documents]);

  const totalChunksLearned = useMemo(
    () =>
      documents.reduce((sum, d) => {
        if (d.status !== "COMPLETED") return sum;
        const n = d.totalChunks ?? 0;
        return sum + (typeof n === "number" ? n : 0);
      }, 0),
    [documents],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-col gap-2 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide">
            Admin
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          RAG 서비스의 사용자·문서 학습 현황을 한곳에서 요약합니다. 아래 바로가기에서
          문서 업로드·웹 수집·외부 DB 연동 설정으로 이동할 수 있습니다.
        </p>
        <p className="text-sm text-foreground">
          {user?.email ? (
            <>
              <span className="font-medium">{user.email}</span>
              <span className="text-muted-foreground"> 님, 환영합니다.</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              로그인하면 이메일과 권한이 표시됩니다.
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          API 베이스 URL: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{API_BASE}</code>
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">바로가기</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            href="/admin/documents"
            title="문서 · 지식 소스"
            description="파일 업로드, URL/사이트 스캔, 외부 DB 테이블 연동 및 학습 상태 확인"
            icon={FileStack}
          />
          <QuickLinkCard
            href="/chat"
            title="AI 채팅"
            description="학습된 지식을 바탕으로 대화 (일반 사용자 화면과 동일)"
            icon={MessageSquare}
          />
          <QuickLinkCard
            href="/admin/login"
            title="관리자 로그인"
            description="세션이 만료되었을 때 토큰을 다시 발급받습니다"
            icon={KeyRound}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">요약 지표</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="전체 사용자" value={users.length} hint="등록된 계정 수" loading={loadingUsers} />
        <StatCard
          title="등록 문서"
          value={loadingDocuments ? "…" : documents.length}
          hint={
            loadingDocuments
              ? "불러오는 중…"
              : `학습 완료 ${completedDocs}건 · 청크 합계 ${totalChunksLearned.toLocaleString()}`
          }
          loading={loadingDocuments}
        />
        <StatCard title="내 권한" value={user?.role ?? "-"} hint="현재 로그인 역할" />
      </div>
      </section>

      <section className="rounded-xl border bg-card/50 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">문서 처리 상태</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              파이프라인별 문서 수 (상세 설정은 문서 관리에서)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="shrink-0 gap-1"
          >
            <Link href="/admin/documents">
              문서 관리
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(DOC_STATUS_LABEL) as DocStatusKey[]).map((key) => (
            <div
              key={key}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                key === "COMPLETED" && "border-emerald-500/30 bg-emerald-500/5",
                key === "PROCESSING" && "border-amber-500/30 bg-amber-500/5",
                key === "FAILED" && "border-destructive/30 bg-destructive/5",
                key === "PENDING" && "border-border bg-muted/30",
              )}
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {DOC_STATUS_LABEL[key]}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {loadingDocuments ? "…" : documentCounts[key]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <aside className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-start gap-2 font-medium text-foreground">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          이 페이지에서 할 수 있는 일
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 pl-1">
          <li>사용자 목록과 역할을 테이블로 확인합니다.</li>
          <li>문서 통계는 전체 문서 API를 기준으로 하며, 파일·웹·DB 소스가 모두 포함됩니다.</li>
          <li>문서 업로드 및 사이트 스캔은 &quot;문서 · 지식 소스&quot; 화면에서 진행합니다.</li>
        </ul>
      </aside>

      {error ? (
        <p className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" aria-hidden />
          사용자 목록
        </h2>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              `/users` API 기준 목록입니다.
            </p>
            <Button variant="outline" size="sm" onClick={() => void loadUsers()}>
              {loadingUsers ? "로딩 중..." : "새로고침"}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>권한</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="p-0">
                    <EmptyState
                      icon={UserRoundSearch}
                      message="사용자 데이터가 없습니다."
                      compact
                    />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{item.name ?? "-"}</TableCell>
                    <TableCell>{item.role}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  loading,
}: {
  title: string;
  value: number | string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          loading && "animate-pulse text-muted-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-semibold text-foreground group-hover:text-primary">
          {title}
          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
