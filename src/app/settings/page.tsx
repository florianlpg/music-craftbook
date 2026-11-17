"use client";

import { useState, useEffect } from "react";
import Link from "next/link";



// ─── Section wrapper ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 divide-y divide-zinc-200 dark:divide-zinc-700">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-600 dark:bg-zinc-900 disabled:opacity-50"
    />
  );
}

// ─── Toast ────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <p className={`rounded-lg px-3 py-2 text-xs ${type === "success" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"}`}>
      {message}
    </p>
  );
}

// ─── YouTube API Key ──────────────────────────────────────────

function YouTubeKeyForm({ hasKey, onUpdate }: { hasKey: boolean; onUpdate: (has: boolean) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch("/api/user/youtube-key", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ msg: "API key saved.", type: "success" });
      setApiKey("");
      onUpdate(true);
    } catch (e) {
      setFeedback({ msg: e instanceof Error ? e.message : "Something went wrong", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch("/api/user/youtube-key", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      });
      if (!res.ok) throw new Error("Failed to remove key");
      setFeedback({ msg: "API key removed.", type: "success" });
      onUpdate(false);
    } catch (e) {
      setFeedback({ msg: e instanceof Error ? e.message : "Something went wrong", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Optional — without a key, search and analyze use yt-dlp (slower, may be less reliable).
        With a key, they use the YouTube Data API v3 for faster and more accurate results.
        Your key is stored on this app’s server.{" "}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-500 hover:underline"
        >
          Get a free key from Google Cloud Console
        </a>{" "}
        — enable the <strong>YouTube Data API v3</strong> and create an API key.
      </p>
      {hasKey && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-400">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Key saved
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading}
            className="text-xs text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
      <form onSubmit={handleSave} className="flex gap-2">
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? "Enter new key to replace…" : "AIza…"}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !apiKey.trim()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? "Saving…" : hasKey ? "Replace key" : "Save key"}
        </button>
      </form>
      {feedback && <Toast message={feedback.msg} type={feedback.type} />}
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────

export default function SettingsPage() {
  const [hasYoutubeKey, setHasYoutubeKey] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => { if (!r.ok) throw new Error("Could not load settings"); return r.json(); })
      .then((data) => setHasYoutubeKey(!!data.hasYoutubeKey))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleExport() {
    const a = document.createElement("a");
    a.href = "/api/user/export";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-red-500" />
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center flex-1 px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {error && <Toast message={error} type="error" />}

        {/* YouTube API key */}
        <div id="youtube-key">
          <Section title="YouTube API key">
            <YouTubeKeyForm
              hasKey={hasYoutubeKey}
              onUpdate={setHasYoutubeKey}
            />
          </Section>
        </div>

        {/* Data & Privacy */}
        <Section title="Data & privacy">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Download a copy of all your data — favorites, songs, and notes — as a JSON file.
              </p>
              <button onClick={handleExport}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Export my data
              </button>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
