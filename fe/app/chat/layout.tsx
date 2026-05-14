"use client";

import { ReactNode, useEffect, useState } from "react";
import { LogOut, MessageSquare, Plus, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3080";

type SidebarUser = {
  email?: string | null;
};

type SidebarConversation = {
  id: string;
  title: string;
  messages?: Array<{
    id: string;
    content: string;
  }>;
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);
  const [conversationPendingDelete, setConversationPendingDelete] = useState<SidebarConversation | null>(null);

  async function loadConversations(accessToken: string) {
    const response = await fetch(`${API_BASE}/ai-chat/my-conversations?limit=20`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json().catch(() => [])) as SidebarConversation[] | { message?: string };
    if (!response.ok || !Array.isArray(data)) {
      setConversations([]);
      return;
    }
    setConversations(data);
  }

  useEffect(() => {
    const syncAuthState = () => {
      const token = window.localStorage.getItem("user_access_token");
      const rawUser = window.localStorage.getItem("user_profile");
      if (!rawUser || !token) {
        setUserEmail(null);
        setConversations([]);
        return;
      }
      try {
        const parsed = JSON.parse(rawUser) as SidebarUser;
        setUserEmail(parsed.email ?? null);
        void loadConversations(token);
      } catch {
        setUserEmail(null);
        setConversations([]);
      }
    };

    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("chat-auth-changed", syncAuthState);
    window.addEventListener("chat-conversations-changed", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("chat-auth-changed", syncAuthState);
      window.removeEventListener("chat-conversations-changed", syncAuthState);
    };
  }, []);

  function onLogout() {
    window.localStorage.removeItem("user_access_token");
    window.localStorage.removeItem("user_profile");
    window.dispatchEvent(new Event("chat-auth-changed"));
    window.location.reload();
  }

  async function onConfirmDeleteConversation() {
    if (!conversationPendingDelete) return;
    const token = window.localStorage.getItem("user_access_token");
    if (!token) return;

    const response = await fetch(`${API_BASE}/ai-chat/my-conversations/${conversationPendingDelete.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      toast.error("대화 삭제에 실패했습니다.");
      return;
    }

    await loadConversations(token);
    window.dispatchEvent(
      new CustomEvent("chat-conversation-deleted", {
        detail: { conversationId: conversationPendingDelete.id },
      }),
    );
    toast.success("대화를 삭제했습니다.");
    setConversationPendingDelete(null);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-3">
          <p className="text-sm font-semibold tracking-tight">AI Chat</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Conversation</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">최근 대화</p>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              onClick={() => {
                window.dispatchEvent(new Event("chat-new-conversation"));
                toast.success("새 대화를 시작했습니다.");
              }}
              title="새 대화"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {conversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-sidebar-border bg-sidebar/50 px-2 py-3">
                <EmptyState
                  icon={MessageSquare}
                  message="아직 대화가 없습니다."
                  compact
                  className="text-sidebar-foreground/80"
                />
              </div>
            ) : (
              conversations.map((item) => (
                <div key={item.id} className="rounded-lg border border-sidebar-border bg-sidebar px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("chat-select-conversation", {
                            detail: { conversationId: item.id },
                          }),
                        )
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-medium">{item.title || "새 대화"}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {item.messages?.[0]?.content ?? "메시지 없음"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversationPendingDelete(item)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                      title="대화 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="mt-auto border-t border-sidebar-border p-3">
          <p className="truncate text-xs font-medium">{userEmail ?? "로그인되지 않음"}</p>
          <p className="truncate text-[11px] text-muted-foreground">{userEmail ? "USER" : "-"}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            disabled={!userEmail}
            className="mt-3 w-full justify-start"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>

      <AlertDialog
        open={Boolean(conversationPendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setConversationPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>대화를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {conversationPendingDelete?.title || "새 대화"} 대화가 삭제되며 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirmDeleteConversation}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
