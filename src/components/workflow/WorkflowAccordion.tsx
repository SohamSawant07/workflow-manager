"use client";

import { useState, type ReactNode } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate } from "@/lib/utils/dates";

interface WorkflowAccordionProps {
  title: string;
  completed: boolean;
  progress: number;
  locked?: boolean;
  blockedReason?: string;
  description?: string;
  stepNumber?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  completedAt?: string;
}

export function WorkflowAccordion({
  title,
  completed,
  progress,
  locked,
  blockedReason,
  description,
  stepNumber,
  defaultOpen = false,
  children,
  completedAt,
}: WorkflowAccordionProps) {
  const [open, setOpen] = useState(defaultOpen || (!locked && !completed));

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-all ${
        locked
          ? "border-zinc-200 bg-zinc-50/90 opacity-80 dark:border-zinc-800 dark:bg-zinc-900/40"
          : completed
            ? "border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
      >
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            completed
              ? "bg-emerald-500 text-white"
              : locked
                ? "bg-zinc-200 text-zinc-400 dark:bg-zinc-700"
                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          }`}
        >
          {completed ? "✓" : locked ? "🔒" : stepNumber}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`font-semibold ${
                locked ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {title}
            </h3>
            {completed && completedAt && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                Completed on {formatDate(completedAt)}
              </span>
            )}
          </div>
          {description && !locked && (
            <p className="mt-1 text-xs text-zinc-500">{description}</p>
          )}
          {locked && blockedReason?.trim() && (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              {blockedReason}
            </p>
          )}
          <div className="mt-3 max-w-md">
            <ProgressBar value={progress} size="sm" />
          </div>
        </div>

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
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}
