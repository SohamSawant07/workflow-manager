"use client";

import Link from "next/link";
import type { AlertInfo } from "@/lib/utils/alerts";

interface AlertCardProps {
  alert: AlertInfo;
}

export function AlertCard({ alert }: AlertCardProps) {
  const { project, priority, currentStep, remainingText } = alert;

  // Format date exactly: DD MMM YYYY (e.g., 12 Jun 2026)
  const formatAlertDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Color mappings for visual priority
  const colorMap = {
    red: {
      border: "border-red-200 dark:border-red-900/50",
      bg: "bg-red-50/50 dark:bg-red-950/10",
      badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      icon: "🚨",
      text: "text-red-700 dark:text-red-400"
    },
    orange: {
      border: "border-orange-200 dark:border-orange-900/50",
      bg: "bg-orange-50/50 dark:bg-orange-950/10",
      badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      icon: "⚠",
      text: "text-orange-700 dark:text-orange-400"
    },
    yellow: {
      border: "border-yellow-200 dark:border-yellow-900/50",
      bg: "bg-yellow-50/50 dark:bg-yellow-950/10",
      badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      icon: "⚠",
      text: "text-yellow-700 dark:text-yellow-400"
    }
  };

  const currentColors = colorMap[priority];

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <div
        className={`rounded-xl border ${currentColors.border} ${currentColors.bg} p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-indigo-500/20 duration-200`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
              <span className="text-lg leading-none" role="img" aria-label="Alert Icon">
                {currentColors.icon}
              </span>
              <span className="truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {project.name}
              </span>
            </h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                alert.type === "project"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30"
                  : "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/50 dark:border-teal-900/30"
              }`}>
                {alert.type === "project" ? "Project Deadline" : "Task Deadline"}
              </span>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${currentColors.badge}`}>
            {priority === "red" ? "Overdue" : "Urgent"}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Site Manager:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {project.siteManagerName || "Unassigned"}
            </span>
          </div>

          {alert.type === "project" ? (
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Current Step:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]" title={currentStep}>
                {currentStep}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Task:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]" title={alert.taskName}>
                {alert.taskName}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Due Date:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {formatAlertDate(alert.dueDate)}
            </span>
          </div>
        </div>

        <div className={`mt-4 border-t ${currentColors.border} pt-3 flex items-center justify-between`}>
          <span className={`text-sm font-bold ${currentColors.text}`}>
            {remainingText}
          </span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 hover:underline">
            Manage workflow
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
