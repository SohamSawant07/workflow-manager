import type {
  MultiSelectCategoryWorkflowNode,
  WorkflowNode,
  WorkflowNodePatch,
} from "@/types/workflow";
import { reconcileWorkflow } from "./pipeline";
import { toggleSubtask } from "./sequential";
import { createLightCategories } from "./definitions";

function updateNodeInWorkflow(
  workflow: WorkflowNode[],
  nodeId: string,
  updater: (node: WorkflowNode) => WorkflowNode
): WorkflowNode[] {
  return workflow.map((node) => (node.id === nodeId ? updater(node) : node));
}

function finalizeWorkflow(workflow: WorkflowNode[]): WorkflowNode[] {
  return reconcileWorkflow(workflow);
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
    return node;
  });
  return finalizeWorkflow(updated);
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
  return finalizeWorkflow(updated);
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
    return node;
  });
  return finalizeWorkflow(updated);
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
  return finalizeWorkflow(updated);
}

export function addCustomStep(
  workflow: WorkflowNode[],
  insertAfterNodeId: string | null,
  step: {
    title: string;
    type: WorkflowNode["type"];
    description?: string;
    taskTitles?: string[];
  }
): WorkflowNode[] {
  const id = crypto.randomUUID();
  const key = `custom_${id}`;
  const baseNode = {
    id,
    key,
    title: step.title,
    type: step.type,
    order: 0,
    description: step.description ?? "",
    completed: false,
    locked: false,
    blockedReason: "",
    custom: true,
    completedAt: undefined,
    notes: "",
    amount: null,
  };

  let newNode: WorkflowNode;

  if (step.type === "checklist") {
    newNode = {
      ...baseNode,
      type: "checklist",
      tasks: (step.taskTitles ?? []).map((title, index) => ({
        id: crypto.randomUUID(),
        title,
        completed: false,
        order: index,
      })),
    };
  } else if (step.type === "numeric_input") {
    newNode = {
      ...baseNode,
      type: "numeric_input",
      value: null,
    };
  } else if (step.type === "text_input") {
    newNode = {
      ...baseNode,
      type: "text_input",
      value: "",
    };
  } else if (step.type === "multi_select_category") {
    newNode = {
      ...baseNode,
      type: "multi_select_category",
      availableCategories: createLightCategories(),
      selectedCategoryIds: [],
    };
  } else {
    newNode = {
      ...baseNode,
      type: "checklist",
      tasks: [],
    };
  }

  const sorted = [...workflow].sort((a, b) => a.order - b.order);
  
  let insertIndex = 0;
  if (insertAfterNodeId !== null) {
    const idx = sorted.findIndex((n) => n.id === insertAfterNodeId);
    if (idx !== -1) {
      insertIndex = idx + 1;
    }
  }

  sorted.splice(insertIndex, 0, newNode);

  const updated = sorted.map((node, index) => ({
    ...node,
    order: index,
  }));

  return finalizeWorkflow(updated);
}

export function deleteCustomStep(
  workflow: WorkflowNode[],
  nodeId: string
): WorkflowNode[] {
  const filtered = workflow.filter((n) => n.id !== nodeId);
  const sorted = filtered.sort((a, b) => a.order - b.order);

  const updated = sorted.map((node, index) => ({
    ...node,
    order: index,
  }));

  return finalizeWorkflow(updated);
}

export function reorderWorkflow(
  workflow: WorkflowNode[],
  activeId: string,
  overId: string
): WorkflowNode[] {
  const sorted = [...workflow].sort((a, b) => a.order - b.order);
  const activeIndex = sorted.findIndex((n) => n.id === activeId);
  const overIndex = sorted.findIndex((n) => n.id === overId);

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return workflow;
  }

  const [removed] = sorted.splice(activeIndex, 1);
  sorted.splice(overIndex, 0, removed);

  const updated = sorted.map((node, index) => ({
    ...node,
    order: index,
  }));

  return finalizeWorkflow(updated);
}

