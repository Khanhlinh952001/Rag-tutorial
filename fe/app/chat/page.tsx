
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";

type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

type AuthResponse = {
  user?: UserProfile;
  accessToken?: string;
  message?: string;
};

type AskResponse = {
  conversationId: string;
  answer: string;
  retrieved?: Array<{
    score?: number;
    content?: string;
    documentId?: string;
  }>;
  urlIngest?: {
    ingested: boolean;
    url: string;
    documentId?: string;
    error?: string;
  };
};

type ConversationDetailResponse = {
  id: string;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT";
    content: string;
  }>;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

function formatAssistantMessage(content: string): string {
  let normalized = content
    .replace(/\r\n/g, "\n")
    // 구형 API 포맷: 장황한 도입부 제거
    .replace(/^검색된 데이터를 기준으로 "[^"]*"에 대한 답변입니다:\s*/m, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+관련 정보:/g, "\n\n#### 추가 근거\n\n")
    .replace(/\n{3,}/g, "\n\n");

  // 구형 한 줄 접두 정리
  if (!normalized.includes("#### ") && normalized.includes("관련 정보")) {
    normalized = normalized.replace(
      /(\n\n)관련 정보:\s*\n/g,
      "\n\n#### 추가 근거\n\n",
    );
  }

  normalized = normalized
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  // 긴 구형 각주를 짧은 한 줄로 (이미 새 포맷이면 유지)
  if (
    normalized.includes("(참고: 현재 일시적인 생성 오류") ||
    normalized.includes("(참고: 생성 모델 응답이 비어")
  ) {
    normalized = normalized
      .replace(
        /\s*\(참고: 생성 모델 응답이 비어 있어 검색 기반 대체 답변을 제공합니다\)\s*$/m,
        "\n\n---\n\n_검색 스니펫 요약 · 생성 모델 응답 없음_",
      )
      .replace(
        /\s*\(참고: 현재 일시적인 생성 오류로 검색 기반 대체 답변을 제공합니다\)\s*$/m,
        "\n\n---\n\n_검색 스니펫 요약 · 일시 오류로 대체 응답_",
      );
  }

  return normalized;
}

function readStoredAuth(): { token: string; user: UserProfile } | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("user_access_token");
  const rawUser = window.localStorage.getItem("user_profile");
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as UserProfile;
    return { token, user };
  } catch {
    return null;
  }
}

function notifyChatAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("chat-auth-changed"));
}

function notifyChatConversationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("chat-conversations-changed"));
}

export default function ChatPage() {
  const isDev = process.env.NODE_ENV === "development";
  const defaultUserEmail = process.env.NEXT_PUBLIC_USER_EMAIL ?? "user@local.dev";
  const defaultUserPassword = process.env.NEXT_PUBLIC_USER_PASSWORD ?? "user123456";
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(isDev ? defaultUserEmail : "");
  const [password, setPassword] = useState(isDev ? defaultUserPassword : "");
  const [name, setName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authHydrated, setAuthHydrated] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isAuthenticated = Boolean(token && user);
  const canSubmitQuestion = isAuthenticated && question.trim().length > 0 && !chatLoading;
  const subtitle = "로그인 후 AI 채팅을 시작하세요.";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStoredAuth();
      if (stored) {
        setToken(stored.token);
        setUser(stored.user);
      }
      setAuthHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleSelectConversation = async (event: Event) => {
      if (!token) return;
      const customEvent = event as CustomEvent<{ conversationId?: string }>;
      const selectedConversationId = customEvent.detail?.conversationId;
      if (!selectedConversationId) return;

      const response = await fetch(`${API_BASE}/ai-chat/my-conversations/${selectedConversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as ConversationDetailResponse | null;
      if (!response.ok || !data) {
        return;
      }

      setConversationId(data.id);
      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
      );
      setChatError("");
    };

    window.addEventListener("chat-select-conversation", handleSelectConversation as EventListener);
    return () =>
      window.removeEventListener("chat-select-conversation", handleSelectConversation as EventListener);
  }, [token]);

  useEffect(() => {
    const handleNewConversation = () => {
      setConversationId(null);
      setMessages([]);
      setChatError("");
    };
    const handleConversationDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId?: string }>;
      if (customEvent.detail?.conversationId && customEvent.detail.conversationId === conversationId) {
        setConversationId(null);
        setMessages([]);
        setChatError("");
      }
    };

    window.addEventListener("chat-new-conversation", handleNewConversation);
    window.addEventListener("chat-conversation-deleted", handleConversationDeleted as EventListener);
    return () => {
      window.removeEventListener("chat-new-conversation", handleNewConversation);
      window.removeEventListener("chat-conversation-deleted", handleConversationDeleted as EventListener);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatLoading]);

  async function onSubmitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const body =
        authMode === "login"
          ? { email, password }
          : { email, password, name: name.trim() || undefined };

      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) {
        setAuthError(typeof data.message === "string" ? data.message : "인증에 실패했습니다.");
        return;
      }
      if (!data.accessToken || !data.user) {
        setAuthError("인증 응답이 올바르지 않습니다.");
        return;
      }

      window.localStorage.setItem("user_access_token", data.accessToken);
      window.localStorage.setItem("user_profile", JSON.stringify(data.user));
      notifyChatAuthChanged();
      setToken(data.accessToken);
      setUser(data.user);
      setConversationId(null);
      setMessages([]);
      setQuestion("");
      setAuthError("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "예상치 못한 오류가 발생했습니다.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function onSubmitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !token) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "USER",
      content: trimmed,
    };

    setChatLoading(true);
    setChatError("");
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      const response = await fetch(`${API_BASE}/ai-chat/ask`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: trimmed,
          conversationId: conversationId ?? undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as
        | AskResponse
        | { message?: string };

      if (!response.ok || !("answer" in data)) {
        let message =
          typeof (data as { message?: unknown })?.message === "string"
            ? (data as { message: string }).message
            : "질문 처리에 실패했습니다.";
        if (response.status === 429) {
          message =
            "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요. (서버 부하·사용자당 제한)";
        }
        setChatError(message);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "ASSISTANT",
        content: data.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.conversationId);
      notifyChatConversationsChanged();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "예상치 못한 오류가 발생했습니다.");
    } finally {
      setChatLoading(false);
    }
  }

  if (!authHydrated) {
    return (
      <main className="mx-auto flex h-full w-full max-w-6xl items-center justify-center px-4 md:px-8">
        <div className="text-sm text-muted-foreground">로딩 중...</div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "mx-auto w-full max-w-6xl px-4 md:px-8",
        isAuthenticated ? "flex h-full flex-col overflow-hidden py-4" : "py-6 md:py-8",
      )}
    >
      <header className={cn("flex flex-wrap items-start justify-between gap-3", isAuthenticated ? "py-3" : "mb-6")}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">사용자 AI 채팅</h1>
          {!isAuthenticated ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          {!isAuthenticated && isDev ? (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              개발 모드 자동 입력 활성화됨
            </p>
          ) : null}
        </div>
      </header>

      {!isAuthenticated ? (
        <section className="mx-auto w-full max-w-md rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={authMode === "login" ? "default" : "outline"}
              onClick={() => setAuthMode("login")}
              className="flex-1"
            >
              로그인
            </Button>
            <Button
              type="button"
              size="sm"
              variant={authMode === "register" ? "default" : "outline"}
              onClick={() => setAuthMode("register")}
              className="flex-1"
            >
              회원가입
            </Button>
          </div>

          <form className="space-y-3" onSubmit={onSubmitAuth}>
            {authMode === "register" ? (
              <label className="block space-y-1">
                <span className="text-sm">이름 (선택)</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            <label className="block space-y-1">
              <span className="text-sm">이메일</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">비밀번호</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
            <Button className="w-full" type="submit" disabled={authLoading}>
              {authLoading
                ? authMode === "login"
                  ? "로그인 중..."
                  : "가입 중..."
                : authMode === "login"
                  ? "로그인"
                  : "회원가입"}
            </Button>
          </form>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1">
          <div className="relative flex min-h-0 flex-1 flex-col bg-background/90">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-lg font-semibold tracking-tight">무엇을 도와드릴까요?</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      아래 입력창에 질문을 적으면 AI가 답변합니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 px-3 py-6 sm:px-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "mx-auto w-full max-w-3xl",
                        msg.role === "USER" ? "flex justify-end" : "flex justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-7",
                          msg.role === "USER"
                            ? "bg-primary text-sm text-primary-foreground"
                            : "bg-muted/80 text-[15px] text-foreground shadow-sm",
                        )}
                      >
                        {msg.role === "ASSISTANT" ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-2 list-disc space-y-1.5 pl-5">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
                              li: ({ children }) => <li className="text-[14px] leading-relaxed">{children}</li>,
                              h1: ({ children }) => <h1 className="mb-2 text-base font-semibold">{children}</h1>,
                              h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
                              h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
                              h4: ({ children }) => (
                                <h4 className="mb-2 mt-2 text-sm font-semibold text-foreground first:mt-0">
                                  {children}
                                </h4>
                              ),
                              hr: () => <hr className="my-3 border-border/60" />,
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline underline-offset-2"
                                >
                                  {children}
                                </a>
                              ),
                              code: ({ className, children }) => {
                                const isBlock = className?.includes("language-");
                                if (isBlock) {
                                  return (
                                    <code className="block overflow-x-auto rounded-md bg-background/70 px-3 py-2 text-xs leading-6">
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <code className="rounded bg-background/70 px-1.5 py-0.5 text-xs">
                                    {children}
                                  </code>
                                );
                              },
                              blockquote: ({ children }) => (
                                <blockquote className="mb-2 border-l-2 border-border/70 pl-3 text-muted-foreground">
                                  {children}
                                </blockquote>
                              ),
                              em: ({ children }) => (
                                <em className="text-[13px] text-muted-foreground">{children}</em>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-foreground">{children}</strong>
                              ),
                            }}
                          >
                            {formatAssistantMessage(msg.content)}
                          </ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading ? (
                    <div className="mx-auto w-full max-w-3xl">
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        AI 답변 생성 중...
                      </div>
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={onSubmitQuestion} className="bg-background/95 pb-1">
              <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-dashed bg-card px-2 py-1 shadow-md">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="질문을 입력하거나, 한 줄에 https URL만 붙여 넣으면 해당 페이지를 학습합니다…"
                  className="flex-1"
                />
                <Button type="submit" size="icon-lg" disabled={!canSubmitQuestion} className="rounded-xl">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              {chatError ? <p className="mx-auto mt-2 w-full max-w-3xl text-xs text-destructive">{chatError}</p> : null}
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
