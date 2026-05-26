import type {
  ChecklistWorkflowNode,
  MultiSelectCategoryWorkflowNode,
  NumericInputWorkflowNode,
  TextInputWorkflowNode,
  WorkflowCategory,
  WorkflowNode,
  WorkflowTask,
} from "@/types/workflow";
import {
  isCategoryCompleted,
  isNodeCompleted,
  isTaskCompleted,
} from "./progress";
import { sortTasks } from "./sequential";

const EMPTY = "";

export function getSortedPipeline(workflow: WorkflowNode[]): WorkflowNode[] {
  return [...workflow].sort((a, b) => a.order - b.order);
}

export function getPipelineNodeIndex(
  workflow: WorkflowNode[],
  nodeId: string
): number {
  const sorted = getSortedPipeline(workflow);
  return sorted.findIndex((n) => n.id === nodeId);
}

/** True when any earlier pipeline step is incomplete */
export function isPipelineStepLocked(
  workflow: WorkflowNode[],
  nodeId: string
): boolean {
  const sorted = getSortedPipeline(workflow);
  const index = sorted.findIndex((n) => n.id === nodeId);
  if (index <= 0) return false;

  return sorted
    .slice(0, index)
    .some((node) => !isNodeCompleted(node));
}

export function getPipelineBlockReason(
  workflow: WorkflowNode[],
  nodeId: string
): string | null {
  if (!isPipelineStepLocked(workflow, nodeId)) return null;

  const sorted = getSortedPipeline(workflow);
  const index = sorted.findIndex((n) => n.id === nodeId);
  const blocker = sorted.slice(0, index).find((n) => !isNodeCompleted(n));

  return blocker
    ? `Complete "${blocker.title}" first`
    : "Complete previous steps first";
}

function deriveCategoryCompleted(category: WorkflowCategory): WorkflowCategory {
  return {
    ...category,
    completed: isCategoryCompleted(category),
  };
}

function deriveNodeCompleted(node: WorkflowNode): WorkflowNode {
  let completed = false;
  let updatedNode = { ...node };

  switch (node.type) {
    case "checklist": {
      const tasks = sortTasks(node.tasks);
      completed = tasks.length > 0 && tasks.every(isTaskCompleted);
      updatedNode = {
        ...node,
        tasks,
        completed,
      };
      break;
    }
    case "numeric_input":
      completed =
        node.completed &&
        node.value !== null &&
        node.value > 0;
      updatedNode = {
        ...node,
        completed,
      };
      break;
    case "text_input":
      completed = node.completed && node.value.trim().length > 0;
      updatedNode = {
        ...node,
        completed,
      };
      break;
    case "multi_select_category": {
      const availableCategories = node.availableCategories.map(
        deriveCategoryCompleted
      );
      const selected = availableCategories.filter((c) =>
        node.selectedCategoryIds.includes(c.id)
      );
      completed = selected.length > 0 && selected.every((c) => c.completed);
      updatedNode = {
        ...node,
        availableCategories,
        completed,
      };
      break;
    }
    default:
      break;
  }

  // Handle completedAt timestamp
  if (completed) {
    if (!node.completedAt) {
      updatedNode.completedAt = new Date().toISOString();
    }
  } else {
    updatedNode.completedAt = undefined;
  }

  return updatedNode;
}

function resetNode(node: WorkflowNode): WorkflowNode {
  switch (node.type) {
    case "checklist":
      return {
        ...node,
        completed: false,
        completedAt: undefined,
        tasks: node.tasks.map((t) => ({ ...t, completed: false })),
      };
    case "numeric_input":
      return { ...node, completed: false, completedAt: undefined };
    case "text_input":
      return { ...node, completed: false, completedAt: undefined };
    case "multi_select_category":
      return {
        ...node,
        completed: false,
        completedAt: undefined,
        availableCategories: node.availableCategories.map((c) => ({
          ...c,
          completed: false,
          tasks: c.tasks.map((t) => ({ ...t, completed: false })),
        })),
      };
    default:
      return node;
  }
}

/** Reset every pipeline step after the first incomplete one */
function cascadeResetDownstreamPipeline(
  workflow: WorkflowNode[]
): WorkflowNode[] {
  const sorted = getSortedPipeline(workflow);
  const idToNode = new Map(workflow.map((n) => [n.id, n]));

  let foundIncomplete = false;
  for (const node of sorted) {
    const derived = deriveNodeCompleted(
      idToNode.get(node.id) ?? node
    );
    idToNode.set(node.id, derived);

    if (!foundIncomplete && !isNodeCompleted(derived)) {
      foundIncomplete = true;
      continue;
    }

    if (foundIncomplete) {
      idToNode.set(node.id, resetNode(derived));
    }
  }

  return workflow.map((n) => idToNode.get(n.id) ?? n);
}

export function applyPipelineLocks(workflow: WorkflowNode[]): WorkflowNode[] {
  return workflow.map((node) => {
    const locked = isPipelineStepLocked(workflow, node.id);
    const blockedReason = getPipelineBlockReason(workflow, node.id) ?? EMPTY;

    return {
      ...node,
      locked,
      blockedReason: locked ? blockedReason : EMPTY,
    };
  });
}

/**
 * Full reconcile: derive completion, cascade downstream resets, apply locks.
 */
export function reconcileWorkflow(workflow: WorkflowNode[]): WorkflowNode[] {
  let w = workflow.map(deriveNodeCompleted);
  w = cascadeResetDownstreamPipeline(w);
  w = w.map(deriveNodeCompleted);
  w = cascadeResetDownstreamPipeline(w);
  return applyPipelineLocks(w);
}

export function isStepEditable(
  workflow: WorkflowNode[],
  nodeId: string
): boolean {
  return !isPipelineStepLocked(workflow, nodeId);
}
