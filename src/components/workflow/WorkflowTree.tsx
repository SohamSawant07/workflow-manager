"use client";

import { useState } from "react";
import type { Project } from "@/types";
import { WorkflowNodePanel } from "./WorkflowNodePanel";
import { AddCustomStepModal } from "./AddCustomStepModal";
import {
  updateWorkflowNode,
  toggleWorkflowTask,
  toggleWorkflowStep,
  toggleWorkflowLightCategory,
  addWorkflowCustomStep,
  deleteWorkflowCustomStep,
} from "@/lib/firestore/projects";
import { getSortedPipeline } from "@/lib/workflow/pipeline";

interface AddStepDividerProps {
  onClick: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function AddStepDivider({ onClick, isFirst = false, isLast = false }: AddStepDividerProps) {
  return (
    <div className="group relative flex h-6 items-center justify-start pl-[2.25rem] select-none">
      {/* Vertical line connecting the steps */}
      <div
        className={`absolute left-[1.65rem] w-0.5 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-600 ${
          isFirst
            ? "top-1/2 bottom-0"
            : isLast
              ? "top-0 bottom-1/2"
              : "top-0 bottom-0"
        }`}
        aria-hidden
      />
      
      {/* Button to add a step, hidden by default, shown on group-hover */}
      <button
        type="button"
        onClick={onClick}
        className="z-10 flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-zinc-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
      >
        <span className="text-[11px] leading-none">+</span> Add Step
      </button>
    </div>
  );
}

interface WorkflowTreeProps {
  project: Project;
}

export function WorkflowTree({ project }: WorkflowTreeProps) {
  const sorted = getSortedPipeline(project.workflow);
  const [insertAfterId, setInsertAfterId] = useState<string | null | undefined>(undefined);

  return (
    <div className="relative flex flex-col">
      {/* Insert at the very beginning (index 0) */}
      <AddStepDivider onClick={() => setInsertAfterId(null)} isFirst />

      {sorted.map((node, index) => {
        const isLastStep = index === sorted.length - 1;
        return (
          <div key={node.id} className="flex flex-col">
            <WorkflowNodePanel
              workflow={project.workflow}
              node={node}
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
              onDeleteCustomStep={(nodeId) => {
                if (window.confirm("Are you sure you want to delete this custom step?")) {
                  deleteWorkflowCustomStep(
                    project.id,
                    project.workflow,
                    nodeId,
                    project.status
                  );
                }
              }}
            />

            {/* Insert after this node */}
            <AddStepDivider
              onClick={() => setInsertAfterId(node.id)}
              isLast={isLastStep}
            />
          </div>
        );
      })}

      <AddCustomStepModal
        open={insertAfterId !== undefined}
        onClose={() => setInsertAfterId(undefined)}
        onConfirm={(step) => {
          if (insertAfterId !== undefined) {
            addWorkflowCustomStep(
              project.id,
              project.workflow,
              insertAfterId,
              step,
              project.status
            );
          }
        }}
      />
    </div>
  );
}
