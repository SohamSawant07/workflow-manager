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

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 17v-2m3 2v-4m3 4v-6M4 5a1 1 0 011-1h4l2 2h8a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
    </svg>
  );
}

function SheetsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 10h18M3 14h18M10 3v18M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
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

// ── Helpers ────────────────────────────────────────────────────────────────

function isGoogleSheetsLink(url: string) {
  return url.includes("docs.google.com/spreadsheets") || url.includes("sheets.google.com");
}

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

// ── Types ──────────────────────────────────────────────────────────────────

type DocData = {
  type: "file" | "link";
  url: string;
  fileName?: string;
  fileType?: "pdf" | "image";
  uploadedAt: string;
  uploadedBy: string;
};

type LayoutItem = DocData;

// ── SOP Box (single file) ──────────────────────────────────────────────────

interface SOPBoxProps {
  docData?: DocData;
  canEdit: boolean;
  onSave: (doc: DocData) => Promise<void>;
  onRemove: () => Promise<void>;
}

function SOPBox({ docData, canEdit, onSave, onRemove }: SOPBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localDoc, setLocalDoc] = useState<DocData | undefined>(docData);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const prevDocData = useRef(docData);
  if (prevDocData.current !== docData) {
    prevDocData.current = docData;
    setLocalDoc(docData);
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadFileToCloudinary(file);
      console.log("[SOP] upload result:", result);
      const doc: DocData = {
        type: "file",
        url: result.url,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "",
      };
      await onSave(doc);
      setLocalDoc(doc);
    } catch (err) {
      console.error("[SOP] upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLinkSave = async () => {
    const url = linkInput.trim();
    if (!url) return;
    setUploading(true);
    setError("");
    try {
      const doc: DocData = { type: "link", url, uploadedAt: new Date().toISOString(), uploadedBy: "" };
      await onSave(doc);
      setLocalDoc(doc);
      setLinkInput("");
      setShowLinkInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  };

  const renderPreview = () => {
    if (!localDoc) return null;
    const { url, fileName, type } = localDoc;
    let icon: React.ReactNode;
    let label: string;
    if (type === "link") {
      if (isGoogleSheetsLink(url)) {
        icon = <SheetsIcon className="h-8 w-8 text-green-500" />;
        label = "Google Sheet";
      } else {
        icon = <LinkIcon className="h-8 w-8 text-indigo-400" />;
        label = url.length > 40 ? url.slice(0, 40) + "…" : url;
      }
    } else {
      icon = <ExcelIcon className="h-8 w-8 text-green-600" />;
      label = fileName ?? "Spreadsheet";
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/30 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors group">
        {icon}
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {label}
        </span>
        <svg className="ml-auto h-4 w-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Site SOP</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Excel file or Google Sheet link</p>
        </div>
        {canEdit && localDoc && (
          <button
            onClick={async () => { setLocalDoc(undefined); await onRemove(); }}
            className="text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
          >
            Remove
          </button>
        )}
      </div>

      {localDoc ? (
        <>
          {renderPreview()}
          {canEdit && (
            <div className="flex gap-2 mt-1">
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                Replace file
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <button onClick={() => setShowLinkInput(!showLinkInput)} disabled={uploading}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                Replace with link
              </button>
            </div>
          )}
        </>
      ) : canEdit ? (
        <div className="flex flex-col gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50">
            <UploadIcon className="h-5 w-5" />
            {uploading ? "Uploading…" : "Upload file"}
          </button>
          <button onClick={() => setShowLinkInput(!showLinkInput)} disabled={uploading}
            className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <LinkIcon className="h-3.5 w-3.5" />
            Paste a link instead
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No document uploaded yet.</p>
        </div>
      )}

      {canEdit && showLinkInput && (
        <div className="flex gap-2 items-center">
          <input type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLinkSave(); } }}
            placeholder="https://..." disabled={uploading}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" />
          <button onClick={handleLinkSave} disabled={uploading || !linkInput.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            Save
          </button>
          <button onClick={() => { setShowLinkInput(false); setLinkInput(""); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Layout Box (multi-file, max 10) ────────────────────────────────────────

const MAX_LAYOUT_FILES = 10;

interface LayoutBoxProps {
  items: LayoutItem[];
  canEdit: boolean;
  onAdd: (items: LayoutItem[]) => Promise<void>;
  onRemoveItem: (index: number) => Promise<void>;
}

function LayoutBox({ items, canEdit, onAdd, onRemoveItem }: LayoutBoxProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const [localItems, setLocalItems] = useState<LayoutItem[]>(items);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const prevItems = useRef(items);
  if (prevItems.current !== items) {
    prevItems.current = items;
    setLocalItems(items);
  }

  const fileToItem = async (file: File): Promise<LayoutItem> => {
    const result = await uploadFileToCloudinary(file);
    console.log("[Layout] upload result:", result);
    const fileType: "pdf" | "image" = file.type === "application/pdf" ? "pdf" : "image";
    return {
      type: "file" as const,
      url: result.url,
      fileName: file.name,
      fileType,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "",
    };
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_LAYOUT_FILES - localItems.length;
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) { setError(`Maximum ${MAX_LAYOUT_FILES} files allowed.`); return; }
    setUploading(true);
    setError("");
    try {
      const uploaded = await Promise.all(toUpload.map(fileToItem));
      const next = [...localItems, ...uploaded];
      await onAdd(next);
      setLocalItems(next);
    } catch (err) {
      console.error("[Layout] upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (addInputRef.current) addInputRef.current.value = "";
    }
  };

  const handleRemove = async (index: number) => {
    const next = localItems.filter((_, i) => i !== index);
    setLocalItems(next);
    await onRemoveItem(index);
  };

  const isEmpty = localItems.length === 0;
  const atMax = localItems.length >= MAX_LAYOUT_FILES;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Site Layout</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            PDF or images · up to {MAX_LAYOUT_FILES} files
          </p>
        </div>
        {canEdit && !isEmpty && !atMax && (
          <button onClick={() => addInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 flex-shrink-0">
            <UploadIcon className="h-3.5 w-3.5" />
            Add more
          </button>
        )}
      </div>

      {isEmpty ? (
        canEdit ? (
          <button onClick={() => addInputRef.current?.click()} disabled={uploading}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50">
            <UploadIcon className="h-5 w-5" />
            {uploading ? "Uploading…" : "Upload files"}
          </button>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No files uploaded yet.</p>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {localItems.map((item, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={item.url}
                    alt={item.fileName ?? `Layout ${index + 1}`}
                    className="w-full h-28 object-cover group-hover:opacity-90 transition-opacity"
                  />
                </a>
                {item.fileName && (
                  <p className="px-1.5 py-1 text-[10px] text-zinc-500 dark:text-zinc-400 truncate bg-white dark:bg-zinc-900">
                    {item.fileName}
                  </p>
                )}
                {canEdit && (
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Remove"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {canEdit && !atMax && (
            <button onClick={() => addInputRef.current?.click()} disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-2.5 text-xs text-zinc-400 dark:text-zinc-500 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50">
              <UploadIcon className="h-4 w-4" />
              {uploading ? "Uploading…" : "Add more files"}
            </button>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <input ref={addInputRef} type="file" multiple
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="hidden" onChange={handleAddFiles} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ProjectDocuments({ project }: ProjectDocumentsProps) {
  const { user } = useAuthContext();
  const canEdit = canEditProject(user, project);
  const uploadedBy = user?.displayName ?? user?.email ?? "Unknown";

  const handleSaveSOP = async (doc: DocData) => {
    await updateProject(project.id, {
      siteSOP: { ...doc, uploadedBy },
    } as Parameters<typeof updateProject>[1]);
  };

  const handleRemoveSOP = async () => {
    await updateProject(project.id, { siteSOP: null } as Parameters<typeof updateProject>[1]);
  };

  // Layout: replace the entire array in Firestore
  const handleLayoutChange = async (items: LayoutItem[]) => {
    await updateProject(project.id, {
      siteLayout: items.map((item) => ({ ...item, uploadedBy })),
    } as Parameters<typeof updateProject>[1]);
  };

  const handleLayoutRemoveItem = async (index: number) => {
    const next = (project.siteLayout ?? []).filter((_, i) => i !== index);
    await updateProject(project.id, {
      siteLayout: next.length ? next : null,
    } as Parameters<typeof updateProject>[1]);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SOPBox
        docData={project.siteSOP as DocData | undefined}
        canEdit={canEdit}
        onSave={handleSaveSOP}
        onRemove={handleRemoveSOP}
      />
      <LayoutBox
        items={(project.siteLayout ?? []) as LayoutItem[]}
        canEdit={canEdit}
        onAdd={handleLayoutChange}
        onRemoveItem={handleLayoutRemoveItem}
      />
    </div>
  );
}
