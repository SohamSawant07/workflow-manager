"use client";

import { useState, type ReactNode } from "react";

interface WorkflowStepControlsProps {
  isFirst: boolean;
  isLast: boolean;
  isLocked: boolean;
  manuallyUnlocked?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUnlock: () => void;
  onRelock: () => void;
}

interface IconButtonProps {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}

function IconButton({ onClick, title, disabled, danger, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 ${
        danger ? "hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function WorkflowStepControls({
  isFirst,
  isLast,
  isLocked,
  manuallyUnlocked,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUnlock,
  onRelock,
}: WorkflowStepControlsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDeleteClick() {
    if (confirmDelete) {
      setConfirmDelete(false);
      onDelete();
    } else {
      setConfirmDelete(true);
      // Auto-cancel confirmation after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <div className="flex items-center">
      {/* Move up */}
      <IconButton
        onClick={onMoveUp}
        title="Move step up"
        disabled={isFirst}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </IconButton>

      {/* Move down */}
      <IconButton
        onClick={onMoveDown}
        title="Move step down"
        disabled={isLast}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </IconButton>

      {/* Unlock / Relock */}
      {isLocked && !manuallyUnlocked && (
        <IconButton onClick={onUnlock} title="Unlock step for preview/editing">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        </IconButton>
      )}
      {manuallyUnlocked && (
        <IconButton onClick={onRelock} title="Re-lock step (restore sequential order)">
          <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 11V7a2 2 0 114 0v4" />
          </svg>
        </IconButton>
      )}

      {/* Delete */}
      <IconButton
        onClick={handleDeleteClick}
        title={confirmDelete ? "Click again to confirm delete" : "Delete step"}
        danger
      >
        {confirmDelete ? (
          <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </IconButton>
    </div>
  );
}
