"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <Image src="/tracelab_logo.png" alt="TraceLab" width={90} height={30} style={{ objectFit: "contain" }} />
        </div>

        <div className="bg-bg-surface border border-border rounded-lg p-8">
          <h1 className="text-xl font-semibold text-slate-100 mb-2">Change password</h1>
          <p className="text-xs text-muted mb-6">You must set a new password before continuing.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1.5">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                required
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-bright transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-bright transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-bright transition-colors"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-medium rounded px-4 py-2.5 transition-colors"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
