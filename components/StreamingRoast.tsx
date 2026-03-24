"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface StreamingRoastProps {
  formData: {
    name: string;
    email?: string;
    date: string;
    time?: string;
    city: string;
  };
}

export default function StreamingRoast({ formData }: StreamingRoastProps) {
  const router = useRouter();
  const [roastText, setRoastText] = useState("");
  const [phase, setPhase] = useState<
    "chart" | "streaming" | "saving" | "error"
  >("chart");
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const startStream = useCallback(async () => {
    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Something went wrong");
        setPhase("error");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "meta") {
            setPhase("streaming");
          } else if (data.type === "text") {
            accumulated += data.text;
            setRoastText(accumulated);
          } else if (data.type === "done") {
            // Server saved successfully — redirect to roast page
            router.push(`/roast/${data.roastId}`);
          } else if (data.type === "error") {
            setError(data.error);
            setPhase("error");
          }
        }
      }
    } catch {
      setError("Connection lost. Please try again.");
      setPhase("error");
    }
  }, [formData, router]);

  useEffect(() => {
    startStream();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart auto-scroll: only if user is near the bottom
  useEffect(() => {
    const el = containerRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [roastText]);

  // Track scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 100;
      isNearBottomRef.current =
        el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-6">
        <p className="text-blood font-mono">{error}</p>
      </div>
    );
  }

  if (phase === "chart") {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-6">
        <p className="text-ash/60 font-mono text-sm animate-pulse">
          Calculating natal chart...
        </p>
      </div>
    );
  }

  // Strip callouts marker from display
  const displayText = roastText.split("---CALLOUTS---")[0];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-void px-6 py-20 max-w-2xl mx-auto overflow-y-auto"
    >
      <p className="text-blood font-mono text-xs tracking-[0.3em] uppercase mb-8">
        {formData.name}&apos;s roast
      </p>
      <div className="text-ash font-serif text-lg leading-relaxed whitespace-pre-wrap">
        {displayText}
      </div>
      {phase === "streaming" && (
        <span className="inline-block w-2 h-5 bg-blood animate-pulse ml-1" />
      )}
    </div>
  );
}
