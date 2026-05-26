import type {
  ChecklistWorkflowNode,
  CustomNoteWorkflowNode,
  MultiSelectCategoryWorkflowNode,
  NumericInputWorkflowNode,
  TextInputWorkflowNode,
  WorkflowCategory,
  WorkflowNode,
  WorkflowTask,
} from "@/types/workflow";
const EMPTY = "";

export function storageTaskForFirestore(task: WorkflowTask): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title ?? EMPTY,
    completed: task.completed ?? false,
    order: task.order ?? 0,
  };
}

function storageCategoryForFirestore(cat: WorkflowCategory): Record<string, unknown> {
  return {
    id: cat.id,
    label: cat.label ?? EMPTY,
    completed: cat.completed ?? false,
    tasks: (cat.tasks ?? []).map(storageTaskForFirestore),
  };
}

function storageNodeBase(node: WorkflowNode) {
  return {
    id: node.id,
    key: node.key,
    title: node.title ?? EMPTY,
    type: node.type,
    order: node.order ?? 0,
    completed: node.completed ?? false,
    description: node.description ?? EMPTY,
    locked: node.locked ?? false,
    blockedReason: node.blockedReason ?? EMPTY,
    completedAt: node.completedAt ?? null,
    manuallyUnlocked: node.manuallyUnlocked ?? false,
    notes: node.notes ?? EMPTY,
    amount: node.amount ?? null,
  };
}

export function prepareWorkflowForFirestore(
  workflow: WorkflowNode[]
): Record<string, unknown>[] {
  return workflow.map((node) => {
    const base = storageNodeBase(node);

    switch (node.type) {
      case "checklist":
        return {
          ...base,
          type: "checklist",
          tasks: (node as ChecklistWorkflowNode).tasks.map(storageTaskForFirestore),
        };
      case "numeric_input":
        return {
          ...base,
          type: "numeric_input",
          value: (node as NumericInputWorkflowNode).value ?? null,
        };
      case "text_input":
        return {
          ...base,
          type: "text_input",
          value: (node as TextInputWorkflowNode).value ?? EMPTY,
        };
      case "multi_select_category": {
        const multi = node as MultiSelectCategoryWorkflowNode;
        return {
          ...base,
          type: "multi_select_category",
          availableCategories: multi.availableCategories.map(
            storageCategoryForFirestore
          ),
          selectedCategoryIds: multi.selectedCategoryIds ?? [],
        };
      }
      case "custom_note":
        return { ...base, type: "custom_note" };
      default:
        return base;
    }
  });
}
