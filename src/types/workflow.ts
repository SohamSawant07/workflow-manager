export type WorkflowNodeType =
  | "checklist"
  | "numeric_input"
  | "text_input"
  | "multi_select_category"
  | "custom_note";

export interface WorkflowTask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface WorkflowCategory {
  id: string;
  label: string;
  tasks: WorkflowTask[];
  /** Derived: true when every subtask is checked */
  completed: boolean;
}

export interface WorkflowNodeBase {
  id: string;
  key: string;
  title: string;
  type: WorkflowNodeType;
  order: number;
  /** Derived: true when this pipeline step is fully done */
  completed: boolean;
  description?: string;
  /** Computed: locked by global pipeline order */
  locked?: boolean;
  blockedReason?: string;
  /** ISO timestamp when this step was last completed */
  completedAt?: string | null;
  /** Manually unlocked by user to allow out-of-order editing */
  manuallyUnlocked?: boolean;
  /** Optional notes visible on any step */
  notes?: string;
  /** Amount field — used by advance_received step */
  amount?: number | null;
}

export interface ChecklistWorkflowNode extends WorkflowNodeBase {
  type: "checklist";
  tasks: WorkflowTask[];
}

export interface NumericInputWorkflowNode extends WorkflowNodeBase {
  type: "numeric_input";
  value: number | null;
}

export interface TextInputWorkflowNode extends WorkflowNodeBase {
  type: "text_input";
  value: string;
}

export interface MultiSelectCategoryWorkflowNode extends WorkflowNodeBase {
  type: "multi_select_category";
  availableCategories: WorkflowCategory[];
  selectedCategoryIds: string[];
}

export interface CustomNoteWorkflowNode extends WorkflowNodeBase {
  type: "custom_note";
}

export type WorkflowNode =
  | ChecklistWorkflowNode
  | NumericInputWorkflowNode
  | TextInputWorkflowNode
  | MultiSelectCategoryWorkflowNode
  | CustomNoteWorkflowNode;

export type WorkflowNodePatch = Partial<
  Omit<WorkflowNodeBase, "id" | "key" | "type" | "order" | "completed">
> & {
  completed?: boolean;
  value?: string | number | null;
  selectedCategoryIds?: string[];
  tasks?: WorkflowTask[];
};

export type WorkflowTaskPatch = Partial<Pick<WorkflowTask, "completed">>;
