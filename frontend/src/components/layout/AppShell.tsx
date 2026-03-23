"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/change-password") {
    return <div className="flex-1">{children}</div>;
  }
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </>
  );
}
