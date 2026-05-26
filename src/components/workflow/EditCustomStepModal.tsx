"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { WorkflowNode } from "@/types/workflow";

interface EditCustomStepModalProps {
  open: boolean;
  onClose: () => void;
  node: WorkflowNode;
  onConfirm: (updates: {
    title: string;
    description: string;
    notes: string;
  }) => void;
}

export function EditCustomStepModal({
  open,
  onClose,
  node,
  onConfirm,
}: EditCustomStepModalProps) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description ?? "");
  const [notes, setNotes] = useState(node.notes ?? "");
  const [error, setError] = useState("");

  // Sync state when node changes or modal opens
  useEffect(() => {
    if (open) {
      setTitle(node.title);
      setDescription(node.description ?? "");
      setNotes(node.notes ?? "");
      setError("");
    }
  }, [open, node]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setError("");
    onConfirm({
      title: title.trim(),
      description: description.trim(),
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Custom Step"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Save Changes
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

        <Input
          label="Description (Optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Final verification before next phase"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add detailed notes for this step..."
            rows={3}
            className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </form>
    </Modal>
  );
}
