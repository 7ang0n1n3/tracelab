"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import Image from "next/image";
import {
  LayoutDashboard,
  FlaskConical,
  PlayCircle,
  KeyRound,
  Settings,
  Users,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tests",     label: "Tests",     icon: FlaskConical },
  { href: "/runs",      label: "Test Results", icon: PlayCircle },
  { href: "/auth",      label: "Auth States", icon: KeyRound },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

const adminNav = [
  { href: "/admin/users", label: "Users", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) { router.replace("/login"); return null; }
        return r.ok ? r.json() : null;
      })
      .then((u) => setUser(u))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  const allNav = user?.role === "admin" ? [...nav, ...adminNav] : nav;

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-bg-surface">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center px-4 py-4 border-b border-border gap-1">
        <Image src="/tracelab_logo.png" alt="TraceLab" width={70} height={20} style={{ objectFit: "contain" }} />
        <span className="text-[10px] text-muted">v0.1.8</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {allNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent/20 text-accent-bright"
                  : "text-muted hover:text-slate-200 hover:bg-bg-elevated"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted hover:text-slate-200 hover:bg-bg-elevated transition-colors"
        >
          {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>

        {/* User */}
        {user && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-slate-300 font-medium truncate">{user.username}</div>
              <div className="text-xs text-muted capitalize">{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="shrink-0 p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
