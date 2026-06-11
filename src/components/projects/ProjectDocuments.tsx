"use client";

import { useRef, useState } from "react";
import type { Project } from "@/types";
import { updateProject } from "@/lib/firestore/projects";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { canEditProject } from "@/lib/auth/permissions";

interface ProjectDocumentsProps {
  project: Project;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 17v-2m3 2v-4m3 4v-6M4 5a1 1 0 011-1h4l2 2h8a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export type DocItem = {
  type: "file" | "link";
  fileType?: "pdf" | "image" | "excel";
  url: string;
  fileName?: string;
  uploadedAt: string;
  uploadedBy: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function uploadFileToCloudinary(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Upload failed");
  }
  return res.json();
}

function getFileType(file: File): "pdf" | "image" | "excel" {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "excel";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function FileTypeIcon({ fileType, className }: { fileType?: "pdf" | "image" | "excel"; className?: string }) {
  if (fileType === "pdf") return <PdfIcon className={className} />;
  if (fileType === "image") return <ImageIcon className={className} />;
  return <ExcelIcon className={className} />;
}

function fileIconColor(fileType?: "pdf" | "image" | "excel") {
  if (fileType === "pdf") return "text-red-500";
  if (fileType === "image") return "text-blue-500";
  return "text-green-600";
}

// ── DocumentBox ────────────────────────────────────────────────────────────

const MAX_ITEMS = 10;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export interface DocumentBoxProps {
  title: string;
  subtitle: string;
  items: DocItem[];
  canEdit: boolean;
  uploadedBy: string;
  onSave: (items: DocItem[]) => Promise<void>;
}

export function DocumentBox({ title, subtitle, items, canEdit, uploadedBy, onSave }: DocumentBoxProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [localItems, setLocalItems] = useState<DocItem[]>(items);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [showAddLink, setShowAddLink] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [replaceMode, setReplaceMode] = useState<"file" | "link" | null>(null);
  const [replaceLinkInput, setReplaceLinkInput] = useState("");

  const prevItems = useRef(items);
  if (prevItems.current !== items) {
    prevItems.current = items;
    setLocalItems(items);
  }

  const persist = async (next: DocItem[]) => {
    await onSave(next.map((item) => ({ ...item, uploadedBy })));
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_ITEMS - localItems.length;
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) { setError(`Maximum ${MAX_ITEMS} files allowed.`); return; }
    setUploading(true);
    setError("");
    try {
      const uploaded = await Promise.all(
        toUpload.map(async (file) => {
          const result = await uploadFileToCloudinary(file);
          return {
            type: "file" as const,
            url: result.url,
            fileName: file.name,
            fileType: getFileType(file),
            uploadedAt: new Date().toISOString(),
            uploadedBy,
          };
        })
      );
      const next = [...localItems, ...uploaded];
      await persist(next);
      setLocalItems(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (addInputRef.current) addInputRef.current.value = "";
    }
  };

  const handleAddLink = async () => {
    const url = linkInput.trim();
    if (!url) return;
    if (localItems.length >= MAX_ITEMS) { setError(`Maximum ${MAX_ITEMS} items allowed.`); return; }
    setUploading(true);
    setError("");
    try {
      const item: DocItem = { type: "link", url, uploadedAt: new Date().toISOString(), uploadedBy };
      const next = [...localItems, item];
      await persist(next);
      setLocalItems(next);
      setLinkInput("");
      setShowAddLink(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (index: number) => {
    const next = localItems.filter((_, i) => i !== index);
    setLocalItems(next);
    try {
      await onSave(next.map((item) => ({ ...item, uploadedBy })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
    if (replacingIndex === index) cancelReplace();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (replacingIndex === null) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadFileToCloudinary(file);
      const item: DocItem = {
        type: "file",
        url: result.url,
        fileName: file.name,
        fileType: getFileType(file),
        uploadedAt: new Date().toISOString(),
        uploadedBy,
      };
      const next = localItems.map((it, i) => (i === replacingIndex ? item : it));
      await persist(next);
      setLocalItems(next);
      cancelReplace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const handleReplaceLink = async () => {
    if (replacingIndex === null) return;
    const url = replaceLinkInput.trim();
    if (!url) return;
    setUploading(true);
    setError("");
    try {
      const item: DocItem = { type: "link", url, uploadedAt: new Date().toISOString(), uploadedBy };
      const next = localItems.map((it, i) => (i === replacingIndex ? item : it));
      await persist(next);
      setLocalItems(next);
      cancelReplace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  };

  const startReplace = (index: number) => {
    setReplacingIndex(index);
    setReplaceMode(null);
    setReplaceLinkInput("");
  };

  const cancelReplace = () => {
    setReplacingIndex(null);
    setReplaceMode(null);
    setReplaceLinkInput("");
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const isEmpty = localItems.length === 0;
  const atMax = localItems.length >= MAX_ITEMS;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
        {canEdit && !isEmpty && !atMax && (
          <button
            onClick={() => addInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 flex-shrink-0"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            Add more
          </button>
        )}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        canEdit ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => addInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
            >
              <UploadIcon className="h-5 w-5" />
              {uploading ? "Uploading…" : "Upload files"}
            </button>
            <button
              onClick={() => setShowAddLink(!showAddLink)}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Paste a link instead
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No documents uploaded yet.</p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {localItems.map((item, index) => (
            <div key={index} className="flex flex-col gap-1">
              {/* Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {item.type === "link" ? (
                      <LinkIcon className="h-5 w-5 text-indigo-400" />
                    ) : (
                      <FileTypeIcon fileType={item.fileType} className={`h-5 w-5 ${fileIconColor(item.fileType)}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {item.type === "link"
                        ? (item.url.length > 50 ? item.url.slice(0, 50) + "…" : item.url)
                        : (item.fileName ?? "File")}
                    </p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {item.uploadedBy && <span>{item.uploadedBy} · </span>}
                      {formatDate(item.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {item.type === "link" ? "Open" : "View"}
                    </a>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => replacingIndex === index ? cancelReplace() : startReplace(index)}
                          disabled={uploading}
                          className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          disabled={uploading}
                          className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Replace panel */}
              {canEdit && replacingIndex === index && (
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 p-3 flex flex-col gap-2">
                  {replaceMode === null && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => { setReplaceMode("file"); setTimeout(() => replaceInputRef.current?.click(), 0); }}
                        disabled={uploading}
                        className="flex items-center gap-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors disabled:opacity-50"
                      >
                        <UploadIcon className="h-3.5 w-3.5" />
                        Upload new file
                      </button>
                      <button
                        onClick={() => setReplaceMode("link")}
                        disabled={uploading}
                        className="flex items-center gap-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors disabled:opacity-50"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Replace with link
                      </button>
                      <button onClick={cancelReplace} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                        Cancel
                      </button>
                    </div>
                  )}
                  {replaceMode === "link" && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="url"
                        value={replaceLinkInput}
                        onChange={(e) => setReplaceLinkInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleReplaceLink(); } }}
                        placeholder="https://..."
                        disabled={uploading}
                        autoFocus
                        className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <button
                        onClick={handleReplaceLink}
                        disabled={uploading || !replaceLinkInput.trim()}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                      <button onClick={cancelReplace} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add more */}
          {canEdit && !atMax && (
            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={() => addInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-2.5 text-xs text-zinc-400 dark:text-zinc-500 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
              >
                <UploadIcon className="h-4 w-4" />
                {uploading ? "Uploading…" : "Add more files"}
              </button>
              <button
                onClick={() => setShowAddLink(!showAddLink)}
                disabled={uploading}
                className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Add a link
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add link input */}
      {canEdit && showAddLink && (
        <div className="flex gap-2 items-center">
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLink(); } }}
            placeholder="https://..."
            disabled={uploading}
            autoFocus
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleAddLink}
            disabled={uploading || !linkInput.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => { setShowAddLink(false); setLinkInput(""); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <input ref={addInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={handleAddFiles} />
      <input ref={replaceInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleReplaceFile} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ProjectDocuments({ project }: ProjectDocumentsProps) {
  const { user } = useAuthContext();
  const canEdit = canEditProject(user, project);
  const uploadedBy = user?.displayName ?? user?.email ?? "Unknown";

  const handleSOPChange = async (items: DocItem[]) => {
    await updateProject(project.id, {
      siteSOP: items.length ? items : null,
    } as Parameters<typeof updateProject>[1]);
  };

  const handleLayoutChange = async (items: DocItem[]) => {
    await updateProject(project.id, {
      siteLayout: items.length ? items : null,
    } as Parameters<typeof updateProject>[1]);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DocumentBox
        title="Site SOP"
        subtitle="PDF, images, or Excel · up to 10 files"
        items={(project.siteSOP ?? []) as DocItem[]}
        canEdit={canEdit}
        uploadedBy={uploadedBy}
        onSave={handleSOPChange}
      />
      <DocumentBox
        title="Site Layout"
        subtitle="PDF, images, or Excel · up to 10 files"
        items={(project.siteLayout ?? []) as DocItem[]}
        canEdit={canEdit}
        uploadedBy={uploadedBy}
        onSave={handleLayoutChange}
      />
    </div>
  );
}
