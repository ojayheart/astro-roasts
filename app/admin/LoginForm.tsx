"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError("Wrong password");
      setPassword("");
    }
  }

  return (
    <form className={styles.login} onSubmit={submit}>
      <input
        className={styles.input}
        type="password"
        inputMode="text"
        autoComplete="current-password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <button
        className={styles.button}
        type="submit"
        disabled={busy || !password}
      >
        {busy ? "…" : "Enter"}
      </button>
      {error && <div className={styles.error}>{error}</div>}
    </form>
  );
}
