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

interface WorkflowNodePanelProps {
  workflow: WorkflowNode[];
  node: WorkflowNode;
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
  onNodeUpdate,
  onTaskToggle,
  onStepToggle,
  onToggleCategory,
  onDeleteCustomStep,
}: WorkflowNodePanelProps) {
  const pipelineLocked = !isNodeEditable(workflow, node.id);
  const disabled = pipelineLocked || node.locked;
  const progress = getNodeProgress(node);
  const stepNumber =
    getSortedPipeline(workflow).findIndex((n) => n.id === node.id) + 1;

  return (
    <WorkflowAccordion
      title={node.title}
      completed={node.completed}
      progress={progress}
      locked={pipelineLocked}
      blockedReason={node.blockedReason}
      description={node.description}
      stepNumber={stepNumber}
      completedAt={node.completedAt}
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

        {node.custom && onDeleteCustomStep && (
          <div className="mt-4 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onDeleteCustomStep(node.id)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:bg-red-100 hover:text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/40"
            >
              Delete Custom Step
            </button>
          </div>
        )}
      </div>
    </WorkflowAccordion>
  );
}
