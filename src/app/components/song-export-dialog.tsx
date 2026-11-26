"use client";

import { useEffect, useRef, useState } from "react";

type ExportState = "loading" | "error" | { text: string };

export function SongExportDialog({
  videoId,
  songName,
  onClose,
}: {
  videoId: string;
  songName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ExportState>("loading");
  const [copyStatus, setCopyStatus] = useState<"copied" | "manual" | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/songs/${encodeURIComponent(videoId)}/export`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Song export failed");
        const data = await response.json();
        if (typeof data.text !== "string") throw new Error("Invalid song export");
        if (!controller.signal.aborted) setState({ text: data.text });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [videoId, attempt]);

  async function copySong() {
    if (typeof state !== "object") return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopyStatus("copied");
    } catch {
      previewRef.current?.focus();
      previewRef.current?.select();
      setCopyStatus("manual");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="song-export-title"
      aria-describedby="song-export-name"
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-xl backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="song-export-title" className="text-base font-semibold">Export song</h2>
            <p id="song-export-name" className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">{songName}</p>
          </div>
          <button
            type="button"
            aria-label="Close export"
            onClick={() => dialogRef.current?.close()}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="flex min-h-0 flex-col px-4 sm:px-6">
          {typeof state === "object" ? (
            <textarea
              ref={previewRef}
              aria-label="Song export preview"
              readOnly
              value={state.text}
              className="h-[min(22rem,55dvh)] w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed break-words focus-visible:outline-2 focus-visible:outline-red-600 dark:border-zinc-700 dark:bg-zinc-950"
            />
          ) : (
            <div className="overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950">
              {state === "loading" ? (
                <p role="status" className="text-zinc-600 dark:text-zinc-400">Preparing export…</p>
              ) : (
                <>
                  <p role="alert">Couldn&apos;t load the song export.</p>
                  <button
                    type="button"
                    onClick={() => { setState("loading"); setAttempt((previous) => previous + 1); }}
                    className="mt-2 min-h-9 rounded font-medium text-red-700 underline underline-offset-2 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 py-4 sm:px-6">
          <p role="status" className="mr-auto text-sm text-zinc-600 dark:text-zinc-400">
            {copyStatus === "copied" && "Copied to clipboard."}
            {copyStatus === "manual" && "Use your device’s copy command to copy the selected text."}
          </p>
          <button
            type="button"
            onClick={copySong}
            disabled={typeof state !== "object"}
            className="min-h-10 shrink-0 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white transition-colors enabled:hover:bg-red-800 enabled:active:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
          >
            Copy content
          </button>
        </footer>
      </div>
    </dialog>
  );
}
