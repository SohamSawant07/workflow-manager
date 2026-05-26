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
import {
  createLightCategories,
  WORKFLOW_NODE_DEFINITIONS,
} from "./definitions";
import { createDefaultWorkflow } from "./factory";
import { reconcileWorkflow } from "./pipeline";
import { WORKFLOW_KEYS } from "./keys";

const EMPTY = "";

function newId(): string {
  return crypto.randomUUID();
}

function toCompleted(value: unknown, legacyStatus?: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (legacyStatus === "completed") return true;
  return false;
}

function normalizeTask(
  task: Partial<WorkflowTask> & { title?: string; status?: unknown },
  index: number
): WorkflowTask {
  return {
    id: task.id ?? newId(),
    title: String(task.title ?? EMPTY).trim(),
    completed: toCompleted(task.completed, task.status),
    order: task.order ?? index,
  };
}

function normalizeCategory(cat: Partial<WorkflowCategory>): WorkflowCategory {
  const catalog = createLightCategories().find((c) => c.id === cat.id);
  const defaultTasks = catalog?.tasks ?? [];
  const tasks = (cat.tasks ?? defaultTasks).map((t, i) =>
    normalizeTask(
      { ...t, title: t.title ?? "", status: (t as { status?: unknown }).status },
      i
    )
  );

  return {
    id: cat.id ?? newId(),
    label: String(cat.label ?? catalog?.label ?? EMPTY).trim(),
    tasks,
    completed: tasks.length > 0 && tasks.every((t) => t.completed),
  };
}

function toAmountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function nodeBaseDefaults(
  raw: Partial<WorkflowNode> & { status?: unknown },
  def?: (typeof WORKFLOW_NODE_DEFINITIONS)[number]
) {
  return {
    id: raw.id ?? newId(),
    key: raw.key ?? def?.key ?? newId(),
    title: String(raw.title ?? def?.title ?? EMPTY).trim(),
    order: raw.order ?? def?.order ?? 0,
    completed: toCompleted(raw.completed, raw.status),
    description: raw.description ?? def?.description ?? EMPTY,
    locked: raw.locked ?? false,
    blockedReason: raw.blockedReason ?? EMPTY,
    completedAt: (raw as { completedAt?: unknown }).completedAt as string | null ?? null,
    manuallyUnlocked: (raw as { manuallyUnlocked?: unknown }).manuallyUnlocked === true,
    notes: String((raw as { notes?: unknown }).notes ?? EMPTY),
    amount: toAmountOrNull((raw as { amount?: unknown }).amount),
  };
}

function normalizeChecklistNode(
  raw: Partial<ChecklistWorkflowNode> & { status?: unknown },
  def?: (typeof WORKFLOW_NODE_DEFINITIONS)[number]
): ChecklistWorkflowNode {
  const defaultTasks =
    def?.taskTitles?.map((title, i) => normalizeTask({ title }, i)) ?? [];

  const tasks = (raw.tasks ?? defaultTasks).map((t, i) =>
    normalizeTask(
      { ...t, title: t.title ?? "", status: (t as { status?: unknown }).status },
      i
    )
  );

  return {
    ...nodeBaseDefaults(raw, def),
    type: "checklist",
    tasks,
  };
}

function normalizeNumericInputNode(
  raw: Partial<NumericInputWorkflowNode> & { status?: unknown },
  def?: (typeof WORKFLOW_NODE_DEFINITIONS)[number]
): NumericInputWorkflowNode {
  const rawValue = raw.value as unknown;
  let value: number | null = null;
  if (
    rawValue !== null &&
    rawValue !== undefined &&
    String(rawValue).trim() !== ""
  ) {
    const num = Number(rawValue);
    value = Number.isFinite(num) ? num : null;
  }

  return {
    ...nodeBaseDefaults(raw, def),
    type: "numeric_input",
    value,
  };
}

function normalizeTextInputNode(
  raw: Partial<TextInputWorkflowNode> & { status?: unknown },
  def?: (typeof WORKFLOW_NODE_DEFINITIONS)[number]
): TextInputWorkflowNode {
  return {
    ...nodeBaseDefaults(raw, def),
    type: "text_input",
    value: String(raw.value ?? EMPTY),
  };
}

function normalizeMultiSelectNode(
  raw: Partial<MultiSelectCategoryWorkflowNode> & { status?: unknown },
  def?: (typeof WORKFLOW_NODE_DEFINITIONS)[number]
): MultiSelectCategoryWorkflowNode {
  const catalog = createLightCategories();
  const available = (raw.availableCategories ?? catalog).map(normalizeCategory);

  return {
    ...nodeBaseDefaults(raw, def),
    type: "multi_select_category",
    availableCategories: available,
    selectedCategoryIds: Array.isArray(raw.selectedCategoryIds)
      ? raw.selectedCategoryIds
      : [],
  };
}

function normalizeCustomNoteNode(
  raw: Partial<CustomNoteWorkflowNode> & { status?: unknown },
  def?: (typeof WORKFLOW_NODE_DEFINITIONS)[number]
): CustomNoteWorkflowNode {
  return {
    ...nodeBaseDefaults(raw, def),
    type: "custom_note",
  };
}

function normalizeNode(
  raw: Partial<WorkflowNode> & { status?: unknown }
): WorkflowNode {
  const def = WORKFLOW_NODE_DEFINITIONS.find((d) => d.key === raw.key);
  let type = raw.type ?? def?.type ?? "checklist";

  if (type === "text_input" && raw.key === WORKFLOW_KEYS.LEAD_TIME) {
    type = "numeric_input";
  }

  switch (type) {
    case "numeric_input":
      return normalizeNumericInputNode(
        raw as Partial<NumericInputWorkflowNode>,
        def
      );
    case "text_input":
      return normalizeTextInputNode(raw as Partial<TextInputWorkflowNode>, def);
    case "multi_select_category":
      return normalizeMultiSelectNode(
        raw as Partial<MultiSelectCategoryWorkflowNode>,
        def
      );
    case "custom_note":
      return normalizeCustomNoteNode(
        raw as Partial<CustomNoteWorkflowNode>,
        def
      );
    case "checklist":
    default:
      return normalizeChecklistNode(raw as Partial<ChecklistWorkflowNode>, def);
  }
}

export function normalizeWorkflow(workflow?: WorkflowNode[]): WorkflowNode[] {
  const source =
    workflow && workflow.length > 0 ? workflow : createDefaultWorkflow();

  const normalized = source
    .map((node) => normalizeNode(node as Partial<WorkflowNode> & { status?: unknown }))
    .sort((a, b) => a.order - b.order);

  return reconcileWorkflow(normalized);
}

export function migrateLegacyStages(): WorkflowNode[] {
  return createDefaultWorkflow();
}
