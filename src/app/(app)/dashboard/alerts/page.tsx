"use client";

import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { getAlertsForUser } from "@/lib/utils/alerts";
import { AlertCard } from "@/components/projects/AlertCard";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type SortOption = "least_time" | "most_time" | "due_date" | "project_name" | "site_manager";

export default function AlertsPage() {
  const { user } = useAuthContext();
  const { projects, loading } = useProjects();
  const [sortBy, setSortBy] = useState<SortOption>("least_time");

  const alerts = getAlertsForUser(projects, user);

  // Sorting logic
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === "least_time") {
      return a.daysRemaining - b.daysRemaining;
    }
    if (sortBy === "most_time") {
      return b.daysRemaining - a.daysRemaining;
    }
    if (sortBy === "due_date") {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    }
    if (sortBy === "project_name") {
      return a.project.name.localeCompare(b.project.name);
    }
    if (sortBy === "site_manager") {
      const mgrA = a.project.siteManagerName || "";
      const mgrB = b.project.siteManagerName || "";
      if (!mgrA) return 1;
      if (!mgrB) return -1;
      return mgrA.localeCompare(mgrB);
    }
    return 0;
  });

  const sortOptions = [
    { value: "least_time", label: "Least Time Remaining" },
    { value: "most_time", label: "Most Time Remaining" },
    { value: "due_date", label: "Due Date" },
    { value: "project_name", label: "Project Name" },
    { value: "site_manager", label: "Site Manager" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>⚠</span> Alerts
            {alerts.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {alerts.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monitor projects with upcoming deadlines in the next 7 days and overdue projects.
          </p>
        </div>

        {alerts.length > 0 && (
          <div className="w-full sm:w-64">
            <Select
              label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              options={sortOptions}
            />
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title="All clear!"
          description="There are no overdue projects or projects due within the next 7 days. Excellent work!"
          action={
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
