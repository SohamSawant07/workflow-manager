import type { Project, ProjectCreateInput, ProjectStatus } from "@/types";
import type { ProjectCreator } from "@/types/auth";
import { normalizeWorkflow } from "@/lib/workflow/normalize";
import { prepareWorkflowForFirestore } from "@/lib/workflow/storage";
import { calculateWorkflowProgress } from "@/lib/workflow/progress";
import { sanitizeFirestorePayload } from "@/lib/firestore/sanitize";

export const DEFAULT_PROJECT_STATUS: ProjectStatus = "planning";
export const DEFAULT_PROJECT_PROGRESS = 0;

export const PROJECT_FIELD_DEFAULTS = {
  name: "",
  clientName: "",
  progress: DEFAULT_PROJECT_PROGRESS,
  status: DEFAULT_PROJECT_STATUS,
  createdByUid: "",
  createdByName: "",
  createdByEmail: "",
  workflow: [] as ReturnType<typeof normalizeWorkflow>,
  address: "",
  city: "",
  landmark: "",
  googleMapsLink: "",
  clientPhone: "",
  startDate: "",
} as const;

/** Payload ready for Firestore after sanitization (no undefined). */
export interface ProjectFirestoreDocument {
  name: string;
  clientName: string;
  deadline: ReturnType<typeof sanitizeDeadlineForFirestore>;
  progress: number;
  status: ProjectStatus;
  workflow: Record<string, unknown>[];
  createdByUid: string;
  createdByName: string;
  createdByEmail: string;
  address?: string;
  city?: string;
  landmark?: string;
  googleMapsLink?: string;
  clientPhone?: string;
  startDate: string;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PROJECT_PROGRESS;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function parseOptionalDeadline(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function sanitizeDeadlineForFirestore(
  deadline: string | undefined
): string | null {
  if (!deadline?.trim()) return null;
  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeProjectStatus(
  status: ProjectStatus | undefined
): ProjectStatus {
  const valid: ProjectStatus[] = [
    "planning",
    "in_progress",
    "review",
    "completed",
    "on_hold",
  ];
  return status && valid.includes(status) ? status : DEFAULT_PROJECT_STATUS;
}

export function normalizeProjectInput(
  input: ProjectCreateInput
): Omit<Project, "id" | "createdAt" | "updatedAt"> {
  const workflow = normalizeWorkflow(input.workflow);
  const progress =
    input.progress !== undefined
      ? clampProgress(input.progress)
      : calculateWorkflowProgress(workflow);

  const parsedStartDate = input.startDate?.trim()
    ? new Date(input.startDate)
    : new Date();
  const startDate = Number.isNaN(parsedStartDate.getTime())
    ? new Date().toISOString()
    : parsedStartDate.toISOString();

  return {
    name: (input.name ?? PROJECT_FIELD_DEFAULTS.name).trim(),
    clientName: (input.clientName ?? PROJECT_FIELD_DEFAULTS.clientName).trim(),
    deadline: parseOptionalDeadline(input.deadline),
    progress,
    status: normalizeProjectStatus(input.status),
    workflow,
    createdByUid: input.createdByUid ?? PROJECT_FIELD_DEFAULTS.createdByUid,
    createdByName: input.createdByName ?? PROJECT_FIELD_DEFAULTS.createdByName,
    createdByEmail:
      input.createdByEmail ?? PROJECT_FIELD_DEFAULTS.createdByEmail,
    address: (input.address ?? PROJECT_FIELD_DEFAULTS.address).trim(),
    city: (input.city ?? PROJECT_FIELD_DEFAULTS.city).trim(),
    landmark: (input.landmark ?? PROJECT_FIELD_DEFAULTS.landmark).trim(),
    googleMapsLink: (input.googleMapsLink ?? PROJECT_FIELD_DEFAULTS.googleMapsLink).trim(),
    clientPhone: (input.clientPhone ?? PROJECT_FIELD_DEFAULTS.clientPhone).trim(),
    startDate,
  };
}

export function buildFirestoreProjectDocument(
  input: ProjectCreateInput,
  creator: ProjectCreator
): ProjectFirestoreDocument {
  const normalized = normalizeProjectInput({
    ...input,
    createdByUid: creator.uid,
    createdByName: creator.displayName,
    createdByEmail: creator.email,
  });

  return sanitizeFirestorePayload({
    name: normalized.name,
    clientName: normalized.clientName,
    deadline: sanitizeDeadlineForFirestore(normalized.deadline),
    progress: normalized.progress,
    status: normalized.status,
    workflow: prepareWorkflowForFirestore(normalized.workflow),
    createdByUid: normalized.createdByUid,
    createdByName: normalized.createdByName,
    createdByEmail: normalized.createdByEmail,
    address: normalized.address,
    city: normalized.city,
    landmark: normalized.landmark,
    googleMapsLink: normalized.googleMapsLink,
    clientPhone: normalized.clientPhone,
    startDate: normalized.startDate,
  });
}

export function buildFirestoreUpdateDocument(
  updates: ProjectUpdateInput
): Partial<ProjectFirestoreDocument> {
  const result: Partial<ProjectFirestoreDocument> = {};

  if (updates.name !== undefined) {
    result.name = (updates.name ?? PROJECT_FIELD_DEFAULTS.name).trim();
  }
  if (updates.clientName !== undefined) {
    result.clientName = (
      updates.clientName ?? PROJECT_FIELD_DEFAULTS.clientName
    ).trim();
  }
  if (updates.deadline !== undefined) {
    result.deadline = sanitizeDeadlineForFirestore(updates.deadline);
  }
  if (updates.status !== undefined) {
    result.status = normalizeProjectStatus(updates.status);
  }
  if (updates.workflow !== undefined) {
    result.workflow = prepareWorkflowForFirestore(updates.workflow);
    if (updates.progress === undefined) {
      result.progress = calculateWorkflowProgress(updates.workflow);
    }
  }
  if (updates.progress !== undefined) {
    result.progress = clampProgress(updates.progress);
  }
  if (updates.address !== undefined) {
    result.address = (updates.address ?? PROJECT_FIELD_DEFAULTS.address).trim();
  }
  if (updates.city !== undefined) {
    result.city = (updates.city ?? PROJECT_FIELD_DEFAULTS.city).trim();
  }
  if (updates.landmark !== undefined) {
    result.landmark = (updates.landmark ?? PROJECT_FIELD_DEFAULTS.landmark).trim();
  }
  if (updates.googleMapsLink !== undefined) {
    result.googleMapsLink = (updates.googleMapsLink ?? PROJECT_FIELD_DEFAULTS.googleMapsLink).trim();
  }
  if (updates.clientPhone !== undefined) {
    result.clientPhone = (updates.clientPhone ?? PROJECT_FIELD_DEFAULTS.clientPhone).trim();
  }
  if (updates.startDate !== undefined) {
    const parsedStartDate = updates.startDate ? new Date(updates.startDate) : new Date();
    result.startDate = Number.isNaN(parsedStartDate.getTime())
      ? new Date().toISOString()
      : parsedStartDate.toISOString();
  }

  return sanitizeFirestorePayload(result);
}

export function normalizeProjectFromFirestore(
  id: string,
  data: Record<string, unknown>
): Project {
  const toIso = (value: unknown, fallback: string): string => {
    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof value === "string" && value) return value;
    return fallback;
  };

  const now = new Date().toISOString();

  const rawWorkflow = data.workflow ?? data.stages;
  const workflow = normalizeWorkflow(
    Array.isArray(rawWorkflow) ? (rawWorkflow as Project["workflow"]) : undefined
  );

  const progress =
    data.progress !== undefined
      ? clampProgress(data.progress as number)
      : calculateWorkflowProgress(workflow);

  const deadlineRaw = data.deadline;
  let deadline: string | undefined;
  if (deadlineRaw !== null && deadlineRaw !== undefined && deadlineRaw !== "") {
    const iso = toIso(deadlineRaw, "");
    deadline = iso || undefined;
  }

  const startDateRaw = data.startDate ?? data.createdAt;
  const startDate = startDateRaw ? toIso(startDateRaw, now) : now;

  return {
    id,
    name: String(data.name ?? PROJECT_FIELD_DEFAULTS.name).trim(),
    clientName: String(
      data.clientName ?? PROJECT_FIELD_DEFAULTS.clientName
    ).trim(),
    deadline,
    progress,
    status: normalizeProjectStatus(data.status as ProjectStatus | undefined),
    workflow,
    createdAt: toIso(data.createdAt, now),
    updatedAt: toIso(data.updatedAt, now),
    createdByUid: String(
      data.createdByUid ?? data.createdBy ?? PROJECT_FIELD_DEFAULTS.createdByUid
    ),
    createdByName: String(
      data.createdByName ?? PROJECT_FIELD_DEFAULTS.createdByName
    ),
    createdByEmail: String(
      data.createdByEmail ?? PROJECT_FIELD_DEFAULTS.createdByEmail
    ),
    createdBy: String(
      data.createdByUid ?? data.createdBy ?? PROJECT_FIELD_DEFAULTS.createdByUid
    ),
    address: data.address ? String(data.address).trim() : "",
    city: data.city ? String(data.city).trim() : "",
    landmark: data.landmark ? String(data.landmark).trim() : "",
    googleMapsLink: data.googleMapsLink ? String(data.googleMapsLink).trim() : "",
    clientPhone: data.clientPhone ? String(data.clientPhone).trim() : "",
    startDate,
  };
}

export type ProjectUpdateInput = Partial<
  Pick<
    Project,
    | "name"
    | "clientName"
    | "deadline"
    | "status"
    | "workflow"
    | "progress"
    | "address"
    | "city"
    | "landmark"
    | "googleMapsLink"
    | "clientPhone"
    | "startDate"
  >
>;

/** @deprecated Use buildFirestoreProjectDocument */
export function buildFirestoreProjectFields(
  input: ProjectCreateInput,
  creator: ProjectCreator
) {
  return buildFirestoreProjectDocument(input, creator);
}

/** @deprecated Use buildFirestoreUpdateDocument */
export function buildFirestoreUpdateFields(updates: ProjectUpdateInput) {
  return buildFirestoreUpdateDocument(updates);
}
