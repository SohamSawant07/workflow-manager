"use client";

import type { ChecklistWorkflowNode } from "@/types/workflow";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SequentialTaskList } from "./SequentialTaskList";

interface AdvanceReceivedNodeContentProps {
  node: ChecklistWorkflowNode;
  disabled?: boolean;
  onTaskToggle: (taskId: string) => void;
  onAmountChange: (amount: number | null) => void;
  onNotesChange: (notes: string) => void;
}

export function AdvanceReceivedNodeContent({
  node,
  disabled,
  onTaskToggle,
  onAmountChange,
  onNotesChange,
}: AdvanceReceivedNodeContentProps) {
  return (
    <div className="space-y-4">
      <Input
        label="Advance Amount (₹)"
        type="number"
        min={0}
        step={1}
        value={node.amount ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onAmountChange(null);
            return;
          }
          const num = parseFloat(raw);
          onAmountChange(Number.isFinite(num) && num > 0 ? num : null);
        }}
        placeholder="e.g. 50000"
        disabled={disabled}
      />
      <Textarea
        label="Notes (optional)"
        value={node.notes ?? ""}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Payment details, reference number…"
        disabled={disabled}
        rows={2}
      />
      <SequentialTaskList
        tasks={node.tasks}
        disabled={disabled}
        onToggle={onTaskToggle}
      />
    </div>
  );
}
