"use client";

import { useState, useEffect } from "react";
import type { WorkflowNode } from "@/types/workflow";
import { WorkflowAccordion } from "./WorkflowAccordion";
import { ChecklistNodeContent } from "./ChecklistNodeContent";
import { TextInputNodeContent } from "./TextInputNodeContent";
import { NumericInputNodeContent } from "./NumericInputNodeContent";
import { LightsCategoryNodeContent } from "./LightsCategoryNodeContent";
import { getNodeProgress } from "@/lib/workflow/progress";
import { isNodeEditable } from "@/lib/workflow/dependencies";
import { getSortedPipeline } from "@/lib/workflow/pipeline";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditCustomStepModal } from "./EditCustomStepModal";

interface NotesSectionProps {
  nodeId: string;
  initialNotes: string;
  onNodeUpdate: (
    nodeId: string,
    patch: import("@/types/workflow").WorkflowNodePatch
  ) => void;
}

function NotesSection({ nodeId, initialNotes, onNodeUpdate }: NotesSectionProps) {
  const [localNotes, setLocalNotes] = useState(initialNotes);

  useEffect(() => {
    setLocalNotes(initialNotes);
  }, [initialNotes]);

  const handleBlur = () => {
    if (localNotes !== initialNotes) {
      onNodeUpdate(nodeId, { notes: localNotes });
    }
  };

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
        Notes
      </label>
      <textarea
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add notes for this step..."
        rows={2}
        className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm text-zinc-800 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
      />
    </div>
  );
}

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

interface WorkflowNodePanelProps {
  workflow: WorkflowNode[];
  node: WorkflowNode;
  isLastStep: boolean;
  onAddStepClick: (nodeId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onNodeUpdate: (
    nodeId: string,
    patch: import("@/types/workflow").WorkflowNodePatch
  ) => void;
  onTaskToggle: (nodeId: string, taskId: string) => void;
  onStepToggle: (nodeId: string) => void;
  onToggleCategory: (nodeId: string, categoryId: string) => void;
  onDeleteCustomStep?: (nodeId: string) => void;
}

export function WorkflowNodePanel({
  workflow,
  node,
  isLastStep,
  onAddStepClick,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onNodeUpdate,
  onTaskToggle,
  onStepToggle,
  onToggleCategory,
  onDeleteCustomStep,
}: WorkflowNodePanelProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const pipelineLocked = !isNodeEditable(workflow, node.id);
  const disabled = pipelineLocked || node.locked;
  const progress = getNodeProgress(node);
  const stepNumber =
    getSortedPipeline(workflow).findIndex((n) => n.id === node.id) + 1;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <WorkflowAccordion
        title={node.title}
        completed={node.completed}
        progress={progress}
        locked={pipelineLocked}
        blockedReason={node.blockedReason}
        description={node.description}
        stepNumber={stepNumber}
        completedAt={node.completedAt}
        dragHandle={
          <div
            className="mt-1 -ml-1 mr-1 flex items-center gap-1 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Move Up Button */}
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMoveUp()}
              className={`flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all hover:bg-zinc-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-indigo-400 ${
                !canMoveUp ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              }`}
              title="Move Step Up"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {/* Move Down Button */}
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMoveDown()}
              className={`flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all hover:bg-zinc-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-indigo-400 ${
                !canMoveDown ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              }`}
              title="Move Step Down"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Drag Grip (keeps Drag and Drop functional) */}
            <div
              {...attributes}
              {...listeners}
              className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-300 touch-none"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 6a1 1 0 100-2 1 1 0 000 2zM7 11a1 1 0 100-2 1 1 0 000 2zM7 16a1 1 0 100-2 1 1 0 000 2zM13 6a1 1 0 100-2 1 1 0 000 2zM13 11a1 1 0 100-2 1 1 0 000 2zM13 16a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {node.type === "checklist" && (
            <ChecklistNodeContent
              node={node}
              disabled={disabled}
              onTaskToggle={(taskId) => onTaskToggle(node.id, taskId)}
              onNodeUpdate={onNodeUpdate}
            />
          )}

          {node.type === "numeric_input" && (
            <NumericInputNodeContent
              node={node}
              disabled={disabled}
              onValueChange={(value) => onNodeUpdate(node.id, { value })}
              onStepToggle={() => onStepToggle(node.id)}
            />
          )}

          {node.type === "text_input" && (
            <TextInputNodeContent
              node={node}
              disabled={disabled}
              onValueChange={(value) => onNodeUpdate(node.id, { value })}
              onStepToggle={() => onStepToggle(node.id)}
            />
          )}

          {node.type === "multi_select_category" && (
            <LightsCategoryNodeContent
              node={node}
              disabled={disabled}
              onToggleCategory={(categoryId) =>
                onToggleCategory(node.id, categoryId)
              }
              onTaskToggle={(taskId) => onTaskToggle(node.id, taskId)}
            />
          )}

          <NotesSection
            nodeId={node.id}
            initialNotes={node.notes ?? ""}
            onNodeUpdate={onNodeUpdate}
          />

          {node.custom && (
            <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Edit Step
              </button>
              {onDeleteCustomStep && (
                <button
                  type="button"
                  onClick={() => onDeleteCustomStep(node.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:bg-red-100 hover:text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                  Delete Custom Step
                </button>
              )}
            </div>
          )}

          <EditCustomStepModal
            open={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            node={node}
            onConfirm={(updates) => onNodeUpdate(node.id, updates)}
          />
        </div>
      </WorkflowAccordion>

      <AddStepDivider onClick={() => onAddStepClick(node.id)} isLast={isLastStep} />
    </div>
  );
}
