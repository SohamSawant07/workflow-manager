"use client";

import { useState } from "react";

interface AddStepBannerProps {
  onAdd: (title: string, notes: string) => void;
}

export function AddStepBanner({ onAdd }: AddStepBannerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), notes.trim());
    setTitle("");
    setNotes("");
    setOpen(false);
  }

  function handleCancel() {
    setTitle("");
    setNotes("");
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add step
        </button>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-4 dark:border-indigo-700 dark:bg-indigo-950/20">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Step title…"
          maxLength={120}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={2}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
