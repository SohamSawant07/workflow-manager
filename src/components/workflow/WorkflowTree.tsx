"use client";

import type { Project } from "@/types";
import { WorkflowNodePanel } from "./WorkflowNodePanel";
import { AddStepBanner } from "./AddStepBanner";
import {
  updateWorkflowNode,
  toggleWorkflowTask,
  toggleWorkflowStep,
  toggleWorkflowLightCategory,
  addCustomWorkflowStep,
  deleteWorkflowStep,
  reorderWorkflowStep,
  unlockWorkflowStep,
  relockWorkflowStep,
} from "@/lib/firestore/projects";
import { getSortedPipeline } from "@/lib/workflow/pipeline";

interface WorkflowTreeProps {
  project: Project;
}

export function WorkflowTree({ project }: WorkflowTreeProps) {
  const sorted = getSortedPipeline(project.workflow);

  return (
    <div className="relative space-y-0">
      {/* Banner before the first step */}
      <AddStepBanner
        onAdd={(title, notes) =>
          addCustomWorkflowStep(
            project.id,
            project.workflow,
            -1,
            title,
            notes,
            project.status
          )
        }
      />

      {sorted.map((node, index) => (
        <div key={node.id} className="relative">
          {index > 0 && (
            <div
              className="absolute -top-3 left-[1.65rem] z-0 h-3 w-0.5 bg-zinc-300 dark:bg-zinc-600"
              aria-hidden
            />
          )}
          <WorkflowNodePanel
            workflow={project.workflow}
            node={node}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            onNodeUpdate={(nodeId, patch) =>
              updateWorkflowNode(
                project.id,
                project.workflow,
                nodeId,
                patch,
                project.status
              )
            }
            onTaskToggle={(nodeId, taskId) =>
              toggleWorkflowTask(
                project.id,
                project.workflow,
                nodeId,
                taskId,
                project.status
              )
            }
            onStepToggle={(nodeId) =>
              toggleWorkflowStep(
                project.id,
                project.workflow,
                nodeId,
                project.status
              )
            }
            onToggleCategory={(nodeId, categoryId) =>
              toggleWorkflowLightCategory(
                project.id,
                project.workflow,
                nodeId,
                categoryId,
                project.status
              )
            }
            onDelete={(nodeId) =>
              deleteWorkflowStep(
                project.id,
                project.workflow,
                nodeId,
                project.status
              )
            }
            onMoveUp={(nodeId) =>
              reorderWorkflowStep(
                project.id,
                project.workflow,
                nodeId,
                "up",
                project.status
              )
            }
            onMoveDown={(nodeId) =>
              reorderWorkflowStep(
                project.id,
                project.workflow,
                nodeId,
                "down",
                project.status
              )
            }
            onUnlock={(nodeId) =>
              unlockWorkflowStep(
                project.id,
                project.workflow,
                nodeId,
                project.status
              )
            }
            onRelock={(nodeId) =>
              relockWorkflowStep(
                project.id,
                project.workflow,
                nodeId,
                project.status
              )
            }
          />

          {/* Banner after each step */}
          <AddStepBanner
            onAdd={(title, notes) =>
              addCustomWorkflowStep(
                project.id,
                project.workflow,
                index,
                title,
                notes,
                project.status
              )
            }
          />
        </div>
      ))}
    </div>
  );
}
