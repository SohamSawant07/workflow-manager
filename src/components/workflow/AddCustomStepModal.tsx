"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { WorkflowNode } from "@/types/workflow";

interface AddCustomStepModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (step: {
    title: string;
    type: WorkflowNode["type"];
    description: string;
    taskTitles?: string[];
  }) => void;
}

export function AddCustomStepModal({
  open,
  onClose,
  onConfirm,
}: AddCustomStepModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkflowNode["type"]>("checklist");
  const [description, setDescription] = useState("");
  const [tasksString, setTasksString] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const taskTitles =
      type === "checklist"
        ? tasksString
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    if (type === "checklist" && taskTitles.length === 0) {
      setError("Please enter at least one task for the checklist");
      return;
    }

    setError("");
    onConfirm({
      title: title.trim(),
      type,
      description: description.trim(),
      taskTitles,
    });
    
    // Reset state
    setTitle("");
    setType("checklist");
    setDescription("");
    setTasksString("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Custom Step"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Add Step
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Step Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Site Inspection"
          required
        />

        <Select
          label="Step Type"
          value={type}
          onChange={(e) => setType(e.target.value as WorkflowNode["type"])}
          options={[
            { value: "checklist", label: "Checklist (Multiple tasks)" },
            { value: "text_input", label: "Text Input (Simple value)" },
            { value: "numeric_input", label: "Numeric Input (Days/count)" },
          ]}
        />

        <Input
          label="Description (Optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Final verification before next phase"
        />

        {type === "checklist" && (
          <Input
            label="Tasks (Comma-separated)"
            value={tasksString}
            onChange={(e) => setTasksString(e.target.value)}
            placeholder="e.g. Check wiring, Test switches, Client sign-off"
          />
        )}

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </form>
    </Modal>
  );
}
