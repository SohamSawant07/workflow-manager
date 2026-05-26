"use client";

import type { WorkflowNode } from "@/types/workflow";
import { WorkflowAccordion } from "./WorkflowAccordion";
import { WorkflowStepControls } from "./WorkflowStepControls";
import { ChecklistNodeContent } from "./ChecklistNodeContent";
import { TextInputNodeContent } from "./TextInputNodeContent";
import { NumericInputNodeContent } from "./NumericInputNodeContent";
import { LightsCategoryNodeContent } from "./LightsCategoryNodeContent";
import { CustomNoteNodeContent } from "./CustomNoteNodeContent";
import { AdvanceReceivedNodeContent } from "./AdvanceReceivedNodeContent";
import { getNodeProgress } from "@/lib/workflow/progress";
import { isNodeEditable } from "@/lib/workflow/dependencies";
import { getSortedPipeline } from "@/lib/workflow/pipeline";
import { WORKFLOW_KEYS } from "@/lib/workflow/keys";

interface WorkflowNodePanelProps {
  workflow: WorkflowNode[];
  node: WorkflowNode;
  isFirst: boolean;
  isLast: boolean;
  onNodeUpdate: (
    nodeId: string,
    patch: import("@/types/workflow").WorkflowNodePatch
  ) => void;
  onTaskToggle: (nodeId: string, taskId: string) => void;
  onStepToggle: (nodeId: string) => void;
  onToggleCategory: (nodeId: string, categoryId: string) => void;
  onDelete: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onUnlock: (nodeId: string) => void;
  onRelock: (nodeId: string) => void;
}

export function WorkflowNodePanel({
  workflow,
  node,
  isFirst,
  isLast,
  onNodeUpdate,
  onTaskToggle,
  onStepToggle,
  onToggleCategory,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUnlock,
  onRelock,
}: WorkflowNodePanelProps) {
  const pipelineLocked = !isNodeEditable(workflow, node.id);
  const manuallyUnlocked = node.manuallyUnlocked === true;
  const disabled = (pipelineLocked && !manuallyUnlocked) || (!pipelineLocked && node.locked);
  const progress = getNodeProgress(node);
  const stepNumber =
    getSortedPipeline(workflow).findIndex((n) => n.id === node.id) + 1;

  const isAdvanceReceived =
    node.type === "checklist" && node.key === WORKFLOW_KEYS.ADVANCE_RECEIVED;

  const controls = (
    <WorkflowStepControls
      isFirst={isFirst}
      isLast={isLast}
      isLocked={pipelineLocked}
      manuallyUnlocked={manuallyUnlocked}
      onMoveUp={() => onMoveUp(node.id)}
      onMoveDown={() => onMoveDown(node.id)}
      onDelete={() => onDelete(node.id)}
      onUnlock={() => onUnlock(node.id)}
      onRelock={() => onRelock(node.id)}
    />
  );

  return (
    <WorkflowAccordion
      title={node.title}
      completed={node.completed}
      progress={progress}
      locked={pipelineLocked}
      manuallyUnlocked={manuallyUnlocked}
      blockedReason={node.blockedReason}
      description={node.description}
      stepNumber={stepNumber}
      completedAt={node.completedAt}
      controls={controls}
    >
      {isAdvanceReceived && node.type === "checklist" && (
        <AdvanceReceivedNodeContent
          node={node}
          disabled={disabled}
          onTaskToggle={(taskId) => onTaskToggle(node.id, taskId)}
          onAmountChange={(amount) => onNodeUpdate(node.id, { amount })}
          onNotesChange={(notes) => onNodeUpdate(node.id, { notes })}
        />
      )}

      {!isAdvanceReceived && node.type === "checklist" && (
        <ChecklistNodeContent
          node={node}
          disabled={disabled}
          onTaskToggle={(taskId) => onTaskToggle(node.id, taskId)}
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

      {node.type === "custom_note" && (
        <CustomNoteNodeContent
          node={node}
          disabled={disabled}
          onStepToggle={() => onStepToggle(node.id)}
          onNotesChange={(notes) => onNodeUpdate(node.id, { notes })}
        />
      )}
    </WorkflowAccordion>
  );
}
