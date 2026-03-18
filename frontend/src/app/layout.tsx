import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "TraceLab",
  description: "Internal browser test automation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden bg-bg font-mono text-slate-200">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
