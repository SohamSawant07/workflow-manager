import type {
  CustomNoteWorkflowNode,
  MultiSelectCategoryWorkflowNode,
  WorkflowNode,
  WorkflowNodePatch,
} from "@/types/workflow";
import { reconcileWorkflow } from "./pipeline";
import { toggleSubtask } from "./sequential";

function updateNodeInWorkflow(
  workflow: WorkflowNode[],
  nodeId: string,
  updater: (node: WorkflowNode) => WorkflowNode
): WorkflowNode[] {
  return workflow.map((node) => (node.id === nodeId ? updater(node) : node));
}

/** Track completedAt timestamps by comparing before/after reconciliation */
function applyCompletedAt(
  before: WorkflowNode[],
  after: WorkflowNode[]
): WorkflowNode[] {
  const now = new Date().toISOString();
  const beforeMap = new Map(before.map((n) => [n.id, n]));
  return after.map((node) => {
    const prev = beforeMap.get(node.id);
    if (!prev) return { ...node, completedAt: node.completedAt ?? null };
    if (!prev.completed && node.completed) return { ...node, completedAt: now };
    if (prev.completed && !node.completed) return { ...node, completedAt: null };
    return { ...node, completedAt: prev.completedAt ?? node.completedAt ?? null };
  });
}

function finalizeWorkflow(
  originalWorkflow: WorkflowNode[],
  updatedWorkflow: WorkflowNode[]
): WorkflowNode[] {
  const reconciled = reconcileWorkflow(updatedWorkflow);
  return applyCompletedAt(originalWorkflow, reconciled);
}

/** Normalize order values to 0, 1, 2, … after sort */
function normalizeOrders(sorted: WorkflowNode[]): WorkflowNode[] {
  return sorted.map((n, i) => ({ ...n, order: i }));
}

export function patchWorkflowNode(
  workflow: WorkflowNode[],
  nodeId: string,
  patch: WorkflowNodePatch
): WorkflowNode[] {
  const updated = updateNodeInWorkflow(workflow, nodeId, (node) => {
    const { value: _v, selectedCategoryIds: _s, tasks: _t, completed: _c, ...basePatch } =
      patch;

    if (node.type === "text_input") {
      const value =
        patch.value !== undefined ? String(patch.value) : node.value;
      let completed =
        patch.completed !== undefined ? patch.completed : node.completed;
      if (!value.trim()) completed = false;
      return { ...node, ...basePatch, value, completed };
    }
    if (node.type === "numeric_input") {
      let value = node.value;
      if (patch.value !== undefined) {
        const num =
          patch.value === null || patch.value === ""
            ? null
            : Number(patch.value);
        value = num !== null && Number.isFinite(num) ? num : null;
      }
      let completed =
        patch.completed !== undefined ? patch.completed : node.completed;
      if (value === null || value <= 0) completed = false;
      return { ...node, ...basePatch, value, completed };
    }
    if (node.type === "multi_select_category") {
      return {
        ...node,
        ...basePatch,
        ...(patch.selectedCategoryIds !== undefined
          ? { selectedCategoryIds: patch.selectedCategoryIds }
          : {}),
      };
    }
    if (node.type === "checklist") {
      return {
        ...node,
        ...basePatch,
        ...(patch.tasks !== undefined ? { tasks: patch.tasks } : {}),
      };
    }
    if (node.type === "custom_note") {
      const completed =
        patch.completed !== undefined ? patch.completed : node.completed;
      return { ...node, ...basePatch, completed };
    }
    return node;
  });
  return finalizeWorkflow(workflow, updated);
}

export function toggleWorkflowTask(
  workflow: WorkflowNode[],
  nodeId: string,
  taskId: string
): WorkflowNode[] {
  const updated = updateNodeInWorkflow(workflow, nodeId, (node) => {
    if (node.type === "checklist") {
      return {
        ...node,
        tasks: toggleSubtask(node.tasks, taskId),
      };
    }
    if (node.type === "multi_select_category") {
      return {
        ...node,
        availableCategories: node.availableCategories.map((cat) => ({
          ...cat,
          tasks: toggleSubtask(cat.tasks, taskId),
        })),
      } satisfies MultiSelectCategoryWorkflowNode;
    }
    return node;
  });
  return finalizeWorkflow(workflow, updated);
}

export function toggleWorkflowStep(
  workflow: WorkflowNode[],
  nodeId: string
): WorkflowNode[] {
  const updated = updateNodeInWorkflow(workflow, nodeId, (node) => {
    if (node.type === "numeric_input") {
      const next = !node.completed;
      if (next && (node.value === null || node.value <= 0)) return node;
      return { ...node, completed: next };
    }
    if (node.type === "text_input") {
      const next = !node.completed;
      if (next && !node.value.trim()) return node;
      return { ...node, completed: next };
    }
    if (node.type === "custom_note") {
      return { ...node, completed: !node.completed };
    }
    return node;
  });
  return finalizeWorkflow(workflow, updated);
}

export function toggleLightCategory(
  workflow: WorkflowNode[],
  nodeId: string,
  categoryId: string
): WorkflowNode[] {
  const updated = updateNodeInWorkflow(workflow, nodeId, (node) => {
    if (node.type !== "multi_select_category") return node;
    const selected = new Set(node.selectedCategoryIds);
    if (selected.has(categoryId)) {
      selected.delete(categoryId);
    } else {
      selected.add(categoryId);
    }
    return {
      ...node,
      selectedCategoryIds: Array.from(selected),
    };
  });
  return finalizeWorkflow(workflow, updated);
}

/** Add a custom note step at the given insertion position (after index, -1 = prepend) */
export function addCustomStep(
  workflow: WorkflowNode[],
  insertAfterIndex: number,
  title: string,
  notes?: string
): WorkflowNode[] {
  const sorted = [...workflow].sort((a, b) => a.order - b.order);

  const newNode: CustomNoteWorkflowNode = {
    id: crypto.randomUUID(),
    key: crypto.randomUUID(),
    title: title.trim() || "Custom Step",
    type: "custom_note",
    description: "",
    order: 0,
    completed: false,
    notes: notes?.trim() ?? "",
    locked: false,
    blockedReason: "",
    completedAt: null,
    manuallyUnlocked: false,
    amount: null,
  };

  sorted.splice(insertAfterIndex + 1, 0, newNode);
  const reordered = normalizeOrders(sorted);
  return finalizeWorkflow(workflow, reordered);
}

/** Remove a node by ID and re-normalize order values */
export function deleteWorkflowNode(
  workflow: WorkflowNode[],
  nodeId: string
): WorkflowNode[] {
  const filtered = workflow.filter((n) => n.id !== nodeId);
  const sorted = [...filtered].sort((a, b) => a.order - b.order);
  const reordered = normalizeOrders(sorted);
  return finalizeWorkflow(workflow, reordered);
}

/** Swap a node up or down in sorted order */
export function reorderWorkflowNodes(
  workflow: WorkflowNode[],
  nodeId: string,
  direction: "up" | "down"
): WorkflowNode[] {
  const sorted = [...workflow].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((n) => n.id === nodeId);
  if (index === -1) return workflow;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return workflow;

  [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
  const reordered = normalizeOrders(sorted);
  return finalizeWorkflow(workflow, reordered);
}

/** Manually unlock a locked step so it can be edited out-of-order */
export function unlockWorkflowNode(
  workflow: WorkflowNode[],
  nodeId: string
): WorkflowNode[] {
  const updated = workflow.map((n) =>
    n.id === nodeId ? { ...n, manuallyUnlocked: true } : n
  );
  return finalizeWorkflow(workflow, updated);
}

/** Re-lock a manually unlocked step, restoring sequential behavior */
export function relockWorkflowNode(
  workflow: WorkflowNode[],
  nodeId: string
): WorkflowNode[] {
  const updated = workflow.map((n) =>
    n.id === nodeId ? { ...n, manuallyUnlocked: false } : n
  );
  return finalizeWorkflow(workflow, updated);
}
