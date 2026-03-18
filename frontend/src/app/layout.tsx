import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "TraceLab",
  description: "Internal browser test automation platform",
};

// Runs before React hydrates — prevents flash of wrong theme
const themeScript = `
  try {
    var t = localStorage.getItem('tracelab-theme');
    if (t !== 'light') document.documentElement.classList.add('dark');
  } catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex h-screen overflow-hidden bg-bg font-mono">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
