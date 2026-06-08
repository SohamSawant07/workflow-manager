export function isOverdue(
  deadline: string | undefined,
  status: string
): boolean {
  if (!deadline || status === "completed") return false;
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntilDeadline(deadline: string): number {
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  return Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function formatDeadlineLabel(deadline?: string): string {
  if (!deadline) return "No deadline set";
  const days = daysUntilDeadline(deadline);
  if (isOverdue(deadline, "in_progress")) {
    return `Overdue · ${formatDate(deadline)}`;
  }
  if (days === 0) return `Due today · ${formatDate(deadline)}`;
  if (days > 0) return `${days} days remaining · ${formatDate(deadline)}`;
  return `${Math.abs(days)} days overdue · ${formatDate(deadline)}`;
}

export function formatAlertDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}
