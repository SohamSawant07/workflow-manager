import type { Project } from "@/types";
import type { AppUser } from "@/types/auth";
import { daysUntilDeadline } from "./dates";
import { isNodeCompleted } from "../workflow/progress";
import { getSortedPipeline } from "../workflow/pipeline";
import { canViewProjectAlert } from "../auth/permissions";

export interface AlertInfo {
  id: string; // unique ID for React lists (e.g. project-id or project-id-task-id)
  type: "project" | "task";
  project: Project;
  daysRemaining: number;
  priority: "red" | "orange" | "yellow";
  currentStep: string;
  taskName?: string;
  remainingText: string;
  dueDate: string;
}

export function getProjectCurrentStep(project: Project): string {
  if (!project.workflow || project.workflow.length === 0) {
    return "Workflow Completed";
  }
  const sorted = getSortedPipeline(project.workflow);
  const firstIncomplete = sorted.find((node) => !isNodeCompleted(node));
  return firstIncomplete ? firstIncomplete.title : "Workflow Completed";
}

function getAlertDetails(deadline: string): { days: number; priority: "red" | "orange" | "yellow"; remainingText: string } | null {
  const days = daysUntilDeadline(deadline);

  if (days <= 7) {
    let priority: "red" | "orange" | "yellow";
    let remainingText = "";

    if (days < 0) {
      priority = "red";
      const absDays = Math.abs(days);
      remainingText = `Overdue by ${absDays} ${absDays === 1 ? "day" : "days"}`;
    } else if (days <= 2) {
      priority = "orange";
      remainingText = days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
    } else {
      priority = "yellow";
      remainingText = `Due in ${days} days`;
    }

    return { days, priority, remainingText };
  }

  return null;
}

export function getAlertsForUser(
  projects: Project[],
  user: AppUser | null | undefined
): AlertInfo[] {
  const allAlerts: AlertInfo[] = [];

  const visibleProjects = projects.filter((p) => canViewProjectAlert(user, p));

  for (const project of visibleProjects) {
    if (project.deleted) continue;

    // 1. Project Deadline Alert (only if project is not completed and has a deadline)
    if (project.status !== "completed" && project.deadline) {
      const details = getAlertDetails(project.deadline);
      if (details) {
        allAlerts.push({
          id: `project-${project.id}`,
          type: "project",
          project,
          daysRemaining: details.days,
          priority: details.priority,
          currentStep: getProjectCurrentStep(project),
          remainingText: details.remainingText,
          dueDate: project.deadline,
        });
      }
    }

    // 2. Task Deadline Alerts (only for incomplete steps with taskDeadline)
    if (project.workflow && project.workflow.length > 0) {
      for (const step of project.workflow) {
        if (!step.completed && step.taskDeadline) {
          const details = getAlertDetails(step.taskDeadline);
          if (details) {
            allAlerts.push({
              id: `task-${project.id}-${step.id}`,
              type: "task",
              project,
              daysRemaining: details.days,
              priority: details.priority,
              currentStep: step.title,
              taskName: step.title,
              remainingText: details.remainingText,
              dueDate: step.taskDeadline,
            });
          }
        }
      }
    }
  }

  // Sort by Least Time Remaining (daysRemaining ascending)
  return allAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

