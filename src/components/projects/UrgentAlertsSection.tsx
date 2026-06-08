"use client";

import Link from "next/link";
import { AlertCard } from "./AlertCard";
import type { AlertInfo } from "@/lib/utils/alerts";
import { Button } from "@/components/ui/Button";

interface UrgentAlertsSectionProps {
  alerts: AlertInfo[];
}

export function UrgentAlertsSection({ alerts }: UrgentAlertsSectionProps) {
  // Urgent alerts are those with priority 'red' (overdue) or 'orange' (due in 2-0 days)
  const urgentAlerts = alerts.filter(
    (a) => a.priority === "red" || a.priority === "orange"
  );

  if (urgentAlerts.length === 0) {
    return null;
  }

  const displayedAlerts = urgentAlerts.slice(0, 5);

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🚨</span>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Urgent Deadlines
          </h2>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            {urgentAlerts.length}
          </span>
        </div>
        <Link href="/dashboard/alerts">
          <Button variant="secondary" size="sm" className="w-full sm:w-auto">
            View All Alerts
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayedAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
