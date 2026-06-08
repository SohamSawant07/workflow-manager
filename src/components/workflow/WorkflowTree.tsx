"use client";

import { useState, useEffect } from "react";
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
  reorderWorkflowSteps,
} from "@/lib/firestore/projects";
import { getSortedPipeline } from "@/lib/workflow/pipeline";
import { reorderWorkflow } from "@/lib/workflow/mutations";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { canEditWorkflowStep } from "@/lib/auth/permissions";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

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
  const { user } = useAuthContext();
  const canEdit = canEditWorkflowStep(user, project);

  const [localWorkflow, setLocalWorkflow] = useState(project.workflow);
  const sorted = getSortedPipeline(localWorkflow);
  const [insertAfterId, setInsertAfterId] = useState<string | null | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  const [prevProjectWorkflow, setPrevProjectWorkflow] = useState(project.workflow);

  if (project.workflow !== prevProjectWorkflow) {
    setPrevProjectWorkflow(project.workflow);
    setLocalWorkflow(project.workflow);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Ensure normal click is not registered as drag
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      // 1. Calculate the optimistic reordered workflow
      const updated = reorderWorkflow(localWorkflow, String(active.id), String(over.id));
      
      // 2. Instantly update local state (buttery smooth visual transition)
      setLocalWorkflow(updated);

      // 3. Persist in background to Firebase
      try {
        await reorderWorkflowSteps(
          project.id,
          project.workflow,
          String(active.id),
          String(over.id),
          project.status
        );
      } catch (error) {
        console.error("Failed to save reordered workflow:", error);
        // Rollback state if the database update fails
        setLocalWorkflow(project.workflow);
      }
    }
  };

  const handleMoveUp = async (nodeId: string) => {
    const index = sorted.findIndex((n) => n.id === nodeId);
    if (index > 0) {
      const activeId = nodeId;
      const overId = sorted[index - 1].id;
      
      const updated = reorderWorkflow(localWorkflow, activeId, overId);
      setLocalWorkflow(updated);

      try {
        await reorderWorkflowSteps(
          project.id,
          project.workflow,
          activeId,
          overId,
          project.status
        );
      } catch (error) {
        console.error("Failed to move step up:", error);
        setLocalWorkflow(project.workflow);
      }
    }
  };

  const handleMoveDown = async (nodeId: string) => {
    const index = sorted.findIndex((n) => n.id === nodeId);
    if (index < sorted.length - 1) {
      const activeId = nodeId;
      const overId = sorted[index + 1].id;
      
      const updated = reorderWorkflow(localWorkflow, activeId, overId);
      setLocalWorkflow(updated);

      try {
        await reorderWorkflowSteps(
          project.id,
          project.workflow,
          activeId,
          overId,
          project.status
        );
      } catch (error) {
        console.error("Failed to move step down:", error);
        setLocalWorkflow(project.workflow);
      }
    }
  };

  if (!mounted) {
    return (
      <div className="relative flex flex-col">
        {/* Insert at the very beginning (index 0) */}
        {canEdit && <AddStepDivider onClick={() => setInsertAfterId(null)} isFirst />}

        {sorted.map((node, index) => {
          const isLastStep = index === sorted.length - 1;
          return (
            <WorkflowNodePanel
              key={node.id}
              workflow={localWorkflow}
              node={node}
              isLastStep={isLastStep}
              canMoveUp={index > 0}
              canMoveDown={index < sorted.length - 1}
              onMoveUp={() => handleMoveUp(node.id)}
              onMoveDown={() => handleMoveDown(node.id)}
              onAddStepClick={(id) => setInsertAfterId(id)}
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
              onDeleteCustomStep={canEdit ? (nodeId) => {
                if (window.confirm("Are you sure you want to delete this step?")) {
                  deleteWorkflowCustomStep(
                    project.id,
                    project.workflow,
                    nodeId,
                    project.status
                  );
                }
              } : undefined}
              readOnly={!canEdit}
            />
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sorted.map((n) => n.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="relative flex flex-col">
          {/* Insert at the very beginning (index 0) */}
          {canEdit && <AddStepDivider onClick={() => setInsertAfterId(null)} isFirst />}

          {sorted.map((node, index) => {
            const isLastStep = index === sorted.length - 1;
            return (
              <WorkflowNodePanel
                key={node.id}
                workflow={localWorkflow}
                node={node}
                isLastStep={isLastStep}
                canMoveUp={index > 0}
                canMoveDown={index < sorted.length - 1}
                onMoveUp={() => handleMoveUp(node.id)}
                onMoveDown={() => handleMoveDown(node.id)}
                onAddStepClick={(id) => setInsertAfterId(id)}
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
                onDeleteCustomStep={canEdit ? (nodeId) => {
                  if (window.confirm("Are you sure you want to delete this step?")) {
                    deleteWorkflowCustomStep(
                      project.id,
                      project.workflow,
                      nodeId,
                      project.status
                    );
                  }
                } : undefined}
                readOnly={!canEdit}
              />
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
      </SortableContext>
    </DndContext>
  );
}

