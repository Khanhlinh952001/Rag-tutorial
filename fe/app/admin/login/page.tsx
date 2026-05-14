"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LoginResponse = {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
  };
  accessToken?: string;
  message?: string;
};

export default function AdminLoginPage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === "development";
  const defaultApiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3080",
    [],
  );
  const defaultAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "admin@local.dev";
  const defaultAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "admin123456";

  const [email, setEmail] = useState(isDev ? defaultAdminEmail : "");
  const [password, setPassword] = useState(isDev ? defaultAdminPassword : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${defaultApiBase}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok) {
        setError(typeof data.message === "string" ? data.message : "로그인에 실패했습니다.");
        return;
      }
      if (!data.accessToken || !data.user) {
        setError("로그인 응답이 올바르지 않습니다.");
        return;
      }
      if (data.user.role !== "ADMIN") {
        setError("이 계정에는 ADMIN 권한이 없습니다.");
        return;
      }

      localStorage.setItem("admin_access_token", data.accessToken);
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("admin-auth-changed"));
      router.replace("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "예상치 못한 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-semibold">관리자 로그인</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        ADMIN 권한 계정으로 로그인하세요.
      </p>
      {isDev ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          API: {defaultApiBase}
        </p>
      ) : null}
      {isDev ? (
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
          개발 모드 자동 입력 활성화됨
        </p>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block space-y-1">
          <span className="text-sm">이메일</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">비밀번호</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </main>
  );
}
