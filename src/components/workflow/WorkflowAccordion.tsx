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
  dragHandle?: ReactNode;
  readOnly?: boolean;
  onCompletedAtChange?: (newDate: string) => void;
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
  dragHandle,
  readOnly = false,
  onCompletedAtChange,
}: WorkflowAccordionProps) {
  const [open, setOpen] = useState(defaultOpen || (!locked && !completed));
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState("");

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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-t-xl"
      >
        {dragHandle}

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
              <span
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                onClick={(e) => {
                  if (locked || readOnly) return;
                  e.stopPropagation();
                }}
              >
                {isEditingDate && !locked && !readOnly ? (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      value={tempDate}
                      onChange={(e) => setTempDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (tempDate && onCompletedAtChange) {
                            const d = new Date(tempDate);
                            onCompletedAtChange(d.toISOString());
                          }
                          setIsEditingDate(false);
                        } else if (e.key === "Escape") {
                          setIsEditingDate(false);
                        }
                      }}
                      className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tempDate && onCompletedAtChange) {
                          const d = new Date(tempDate);
                          onCompletedAtChange(d.toISOString());
                        }
                        setIsEditingDate(false);
                      }}
                      className="rounded bg-emerald-600 p-0.5 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 flex items-center justify-center shrink-0"
                      title="Save date"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingDate(false);
                      }}
                      className="rounded bg-zinc-200 p-0.5 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 flex items-center justify-center shrink-0"
                      title="Cancel"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <span>Completed on {formatDate(completedAt)}</span>
                    {!locked && !readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempDate(completedAt ? completedAt.split("T")[0] : "");
                          setIsEditingDate(true);
                        }}
                        className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                        title="Edit completion date"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
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
      </div>

      {open && (
        <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}
