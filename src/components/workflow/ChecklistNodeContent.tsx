"use client";

import type { ChecklistWorkflowNode, WorkflowNodePatch } from "@/types/workflow";
import { SequentialTaskList } from "./SequentialTaskList";
import { Input } from "@/components/ui/Input";

interface ChecklistNodeContentProps {
  node: ChecklistWorkflowNode;
  disabled?: boolean;
  onTaskToggle: (taskId: string) => void;
  onNodeUpdate?: (nodeId: string, patch: WorkflowNodePatch) => void;
}

export function ChecklistNodeContent({
  node,
  disabled,
  onTaskToggle,
  onNodeUpdate,
}: ChecklistNodeContentProps) {
  const isAdvanceReceived = node.key === "advance_received";

  return (
    <div className="space-y-4">
      {isAdvanceReceived && onNodeUpdate && (
        <div className="max-w-xs">
          <Input
            label="Advance Amount (₹)"
            type="number"
            min={0}
            value={node.amount ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const num = val === "" ? null : Number(val);
              onNodeUpdate(node.id, { amount: num });
            }}
            placeholder="Enter amount, e.g. 50000"
            disabled={disabled}
          />
        </div>
      )}
      <SequentialTaskList
        tasks={node.tasks}
        disabled={disabled}
        onToggle={onTaskToggle}
      />
    </div>
  );
}
