import type {
  MultiSelectCategoryWorkflowNode,
  WorkflowCategory,
  WorkflowNode,
  WorkflowTask,
} from "@/types/workflow";

export function isTaskCompleted(task: WorkflowTask): boolean {
  return task.completed === true;
}

export function isCategoryCompleted(category: WorkflowCategory): boolean {
  return (
    category.tasks.length > 0 &&
    category.tasks.every(isTaskCompleted)
  );
}

export function isNodeCompleted(node: WorkflowNode): boolean {
  switch (node.type) {
    case "checklist":
      return (
        node.tasks.length > 0 && node.tasks.every(isTaskCompleted)
      );
    case "numeric_input":
      return node.completed;
    case "text_input":
      return node.completed;
    case "multi_select_category": {
      const selected = node.availableCategories.filter((c) =>
        node.selectedCategoryIds.includes(c.id)
      );
      if (selected.length === 0) return false;
      return selected.every(isCategoryCompleted);
    }
    case "custom_note":
      return node.completed === true;
    default:
      return false;
  }
}

function countNodeUnits(node: WorkflowNode): { total: number; completed: number } {
  switch (node.type) {
    case "checklist": {
      const total = node.tasks.length;
      const completed = node.tasks.filter(isTaskCompleted).length;
      return { total, completed };
    }
    case "numeric_input":
    case "text_input":
    case "custom_note":
      return { total: 1, completed: isNodeCompleted(node) ? 1 : 0 };
    case "multi_select_category": {
      const selected = (node as MultiSelectCategoryWorkflowNode).availableCategories.filter((c) =>
        node.selectedCategoryIds.includes(c.id)
      );
      return selected.reduce(
        (acc, cat) => ({
          total: acc.total + cat.tasks.length,
          completed:
            acc.completed + cat.tasks.filter(isTaskCompleted).length,
        }),
        { total: 0, completed: 0 }
      );
    }
    default:
      return { total: 0, completed: 0 };
  }
}

export function getNodeProgress(node: WorkflowNode): number {
  const { total, completed } = countNodeUnits(node);
  if (total === 0) return isNodeCompleted(node) ? 100 : 0;
  return Math.round((completed / total) * 100);
}

export function calculateWorkflowProgress(workflow: WorkflowNode[]): number {
  const totals = workflow.reduce(
    (acc, node) => {
      const units = countNodeUnits(node);
      return {
        total: acc.total + units.total,
        completed: acc.completed + units.completed,
      };
    },
    { total: 0, completed: 0 }
  );

  if (totals.total === 0) return 0;
  return Math.round((totals.completed / totals.total) * 100);
}
