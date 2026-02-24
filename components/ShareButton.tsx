"use client";

import { useState } from "react";

export default function ShareButton({ roastId }: { roastId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/roast/${roastId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="interactive px-6 py-3 border border-ash/20 bg-void text-ash font-mono text-xs uppercase tracking-[0.15em] hover:border-blood hover:text-blood transition-colors duration-300"
    >
      {copied ? "Link Copied" : "Copy Link"}
    </button>
  );
}
