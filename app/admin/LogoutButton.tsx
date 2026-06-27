"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="border border-ash/20 hover:border-blood hover:text-blood disabled:opacity-40 uppercase tracking-[0.2em] text-[0.65rem] px-4 py-2 transition-colors"
    >
      {loading ? "…" : "Log out"}
    </button>
  );
}
