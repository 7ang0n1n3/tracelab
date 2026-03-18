"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me", { credentials: "include" }).then((r) => {
      if (!r.ok) router.replace("/login");
    }).catch(() => router.replace("/login"));
  }, [pathname]);

  if (pathname === "/login") {
    return <div className="flex-1">{children}</div>;
  }
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </>
  );
}
