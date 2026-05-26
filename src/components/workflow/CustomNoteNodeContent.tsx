"use client";

import type { CustomNoteWorkflowNode } from "@/types/workflow";
import { CheckboxRow } from "./CheckboxRow";
import { Textarea } from "@/components/ui/Textarea";

interface CustomNoteNodeContentProps {
  node: CustomNoteWorkflowNode;
  disabled?: boolean;
  onStepToggle: () => void;
  onNotesChange: (notes: string) => void;
}

export function CustomNoteNodeContent({
  node,
  disabled,
  onStepToggle,
  onNotesChange,
}: CustomNoteNodeContentProps) {
  return (
    <div className="space-y-4">
      <Textarea
        label="Notes (optional)"
        value={node.notes ?? ""}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Add notes for this step…"
        disabled={disabled}
        rows={3}
      />
      <CheckboxRow
        label="Mark as complete"
        checked={node.completed}
        disabled={disabled}
        onToggle={onStepToggle}
      />
    </div>
  );
}
