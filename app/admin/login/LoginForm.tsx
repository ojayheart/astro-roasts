"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm">
      <label
        htmlFor="admin-password"
        className="block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3"
      >
        Admin password
      </label>
      <input
        id="admin-password"
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-transparent border border-ash/20 focus:border-blood outline-none px-4 py-3 text-ash text-sm tracking-wide transition-colors"
        placeholder="••••••••••"
      />
      {error && (
        <p className="mt-3 text-blood text-xs tracking-wide">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || password.length === 0}
        className="mt-5 w-full border border-blood text-blood hover:bg-blood hover:text-void disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-blood uppercase tracking-[0.25em] text-xs py-3 transition-colors"
      >
        {loading ? "Verifying…" : "Enter"}
      </button>
    </form>
  );
}
