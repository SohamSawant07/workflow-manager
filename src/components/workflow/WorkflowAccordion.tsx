"use client";

import { useState, type ReactNode } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface WorkflowAccordionProps {
  title: string;
  completed: boolean;
  progress: number;
  locked?: boolean;
  manuallyUnlocked?: boolean;
  blockedReason?: string;
  description?: string;
  stepNumber?: number;
  completedAt?: string | null;
  defaultOpen?: boolean;
  /** Icon buttons rendered in the top-right corner of the card */
  controls?: ReactNode;
  children: ReactNode;
}

function formatCompletedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WorkflowAccordion({
  title,
  completed,
  progress,
  locked,
  manuallyUnlocked,
  blockedReason,
  description,
  stepNumber,
  completedAt,
  defaultOpen = false,
  controls,
  children,
}: WorkflowAccordionProps) {
  const [open, setOpen] = useState(defaultOpen || (!locked && !completed));

  const effectiveLocked = locked && !manuallyUnlocked;

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-all ${
        effectiveLocked
          ? "border-zinc-200 bg-zinc-50/90 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40"
          : manuallyUnlocked && !completed
            ? "border-amber-200 bg-amber-50/20 dark:border-amber-900/50 dark:bg-amber-950/10"
            : completed
              ? "border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Card top row: expand toggle + controls */}
      <div className="flex items-start">
        <button
          type="button"
          onClick={() => !effectiveLocked && setOpen(!open)}
          disabled={effectiveLocked}
          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-4 text-left sm:px-5 disabled:cursor-not-allowed"
        >
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              completed
                ? "bg-emerald-500 text-white"
                : manuallyUnlocked
                  ? "bg-amber-400 text-white"
                  : effectiveLocked
                    ? "bg-zinc-200 text-zinc-400 dark:bg-zinc-700"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            }`}
          >
            {completed ? "✓" : effectiveLocked ? "🔒" : stepNumber}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`font-semibold ${
                  effectiveLocked ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {title}
              </h3>
              {manuallyUnlocked && !completed && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  unlocked
                </span>
              )}
            </div>
            {description && !effectiveLocked && (
              <p className="mt-1 text-xs text-zinc-500">{description}</p>
            )}
            {effectiveLocked && blockedReason?.trim() && (
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                {blockedReason}
              </p>
            )}
            {completed && completedAt && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Completed {formatCompletedAt(completedAt)}
              </p>
            )}
            <div className="mt-3 max-w-md">
              <ProgressBar value={progress} size="sm" />
            </div>
          </div>

          {!effectiveLocked && (
            <svg
              className={`mt-1 h-5 w-5 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>

        {/* Step controls slot */}
        {controls && (
          <div className="flex shrink-0 items-center gap-0.5 pr-2 pt-3">
            {controls}
          </div>
        )}
      </div>

      {open && !effectiveLocked && (
        <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}
