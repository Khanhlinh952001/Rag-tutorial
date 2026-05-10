"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { FileText, LayoutDashboard, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/documents", label: "문서 관리", icon: FileText },
];

function readStoredUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("admin_access_token");
  const rawUser = window.localStorage.getItem("admin_user");
  if (!token || !rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as AdminUser;
    if (parsed.role !== "ADMIN") return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  const [user, setUser] = useState<AdminUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const syncStoredUser = () => {
      setUser(readStoredUser());
      setHydrated(true);
    };

    syncStoredUser();
    window.addEventListener("storage", syncStoredUser);
    window.addEventListener("admin-auth-changed", syncStoredUser);
    return () => {
      window.removeEventListener("storage", syncStoredUser);
      window.removeEventListener("admin-auth-changed", syncStoredUser);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isLoginPage) {
      if (user) {
        router.replace("/admin");
      }
      return;
    }
    if (!user) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("admin_access_token");
        window.localStorage.removeItem("admin_user");
      }
      router.replace("/admin/login");
    }
  }, [hydrated, isLoginPage, router, user]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  function logout() {
    window.localStorage.removeItem("admin_access_token");
    window.localStorage.removeItem("admin_user");
    window.dispatchEvent(new Event("admin-auth-changed"));
    router.replace("/admin/login");
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden h-screen max-h-screen w-60 shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:self-start md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
          <p className="text-sm font-semibold tracking-tight">AI Admin Console</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-3 text-sm">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <p className="truncate text-xs font-medium">{user.email}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user.role}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full justify-start"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4 md:hidden">
          <p className="text-sm font-semibold">AI Admin</p>
          <div className="flex items-center gap-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded px-2 py-1 text-muted-foreground hover:text-foreground",
                  (item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href)) &&
                    "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button variant="outline" size="sm" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
