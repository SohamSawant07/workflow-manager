import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  deleteField,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Project, ProjectCreateInput } from "@/types";
import type { ProjectCreator } from "@/types/auth";
import type {
  WorkflowNode,
  WorkflowNodePatch,
  ChecklistWorkflowNode,
} from "@/types/workflow";
import {
  buildFirestoreProjectDocument,
  buildFirestoreUpdateDocument,
  normalizeProjectFromFirestore,
  normalizeProjectStatus,
  type ProjectUpdateInput,
} from "@/lib/project-defaults";
import { sanitizeFirestorePayload } from "@/lib/firestore/sanitize";
import {
  patchWorkflowNode,
  toggleLightCategory,
  toggleWorkflowTask as applyWorkflowTaskToggle,
  toggleWorkflowStep as applyWorkflowStepToggle,
  addCustomStep,
  deleteCustomStep,
  reorderWorkflow,
} from "@/lib/workflow/mutations";
import { reconcileWorkflow } from "@/lib/workflow/pipeline";
import { calculateWorkflowProgress } from "@/lib/workflow/progress";
import { writeAuditLog } from "./audit";
import { generateUniqueAccessCode } from "@/lib/utils/accessCode";

const COLLECTION = "projects";

export function subscribeToProjects(
  callback: (projects: Project[]) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map((d) =>
      normalizeProjectFromFirestore(d.id, d.data() as Record<string, unknown>)
    );
    callback(projects);
  });
}

export function subscribeToProject(
  id: string,
  callback: (project: Project | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, COLLECTION, id), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(
      normalizeProjectFromFirestore(
        snapshot.id,
        snapshot.data() as Record<string, unknown>
      )
    );
  });
}

export async function createProject(
  input: ProjectCreateInput,
  creator: ProjectCreator
): Promise<string> {
  const clientAccessCode = await generateUniqueAccessCode();
  const document = buildFirestoreProjectDocument({ ...input, clientAccessCode }, creator);
  const now = Timestamp.now();

  const docData = sanitizeFirestorePayload({
    name: document.name,
    clientName: document.clientName,
    deadline: document.deadline
      ? Timestamp.fromDate(new Date(document.deadline))
      : null,
    progress: document.progress,
    status: document.status,
    workflow: document.workflow,
    createdByUid: document.createdByUid,
    createdByName: document.createdByName,
    createdByEmail: document.createdByEmail,
    address: document.address,
    city: document.city,
    landmark: document.landmark,
    googleMapsLink: document.googleMapsLink,
    clientPhone: document.clientPhone,
    clientAccessCode: document.clientAccessCode ?? "",
    startDate: document.startDate,
    siteManagerName: document.siteManagerName ?? "",
    siteContacts: document.siteContacts ?? [],
    createdAt: now,
    updatedAt: now,
  });

  const docRef = await addDoc(collection(db, COLLECTION), docData);
  await writeAuditLog(docRef.id, "create_project", `Created project "${document.name}"`);
  return docRef.id;
}

export async function updateProject(
  id: string,
  updates: ProjectUpdateInput
): Promise<void> {
  const fields = buildFirestoreUpdateDocument(updates);
  const payload: Record<string, unknown> = sanitizeFirestorePayload({
    updatedAt: Timestamp.now(),
  });

  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.clientName !== undefined) payload.clientName = fields.clientName;
  if (fields.siteManagerName !== undefined) payload.siteManagerName = fields.siteManagerName;
  if (fields.deadline !== undefined) {
    payload.deadline =
      fields.deadline === null
        ? deleteField()
        : Timestamp.fromDate(new Date(fields.deadline));
  }
  if (fields.progress !== undefined) payload.progress = fields.progress;
  if (fields.status !== undefined) payload.status = fields.status;
  if (fields.workflow !== undefined) payload.workflow = fields.workflow;
  if (fields.address !== undefined) payload.address = fields.address;
  if (fields.city !== undefined) payload.city = fields.city;
  if (fields.landmark !== undefined) payload.landmark = fields.landmark;
  if (fields.googleMapsLink !== undefined) payload.googleMapsLink = fields.googleMapsLink;
  if (fields.clientPhone !== undefined) payload.clientPhone = fields.clientPhone;
  if (fields.clientAccessCode !== undefined) payload.clientAccessCode = fields.clientAccessCode;

  if (fields.startDate !== undefined) payload.startDate = fields.startDate;
  if (fields.siteContacts !== undefined) payload.siteContacts = fields.siteContacts;
  if (fields.siteSOP !== undefined) payload.siteSOP = fields.siteSOP ?? deleteField();
  if (fields.siteLayout !== undefined) payload.siteLayout = fields.siteLayout ?? deleteField();

  await updateDoc(doc(db, COLLECTION, id), payload);

  // Only log as project details update if workflow changes are not included
  if (updates.workflow === undefined) {
    await writeAuditLog(id, "update_project", "Updated project details");
  }
}

async function saveWorkflow(
  projectId: string,
  workflow: WorkflowNode[],
  currentStatus: Project["status"]
): Promise<void> {
  const reconciled = reconcileWorkflow(workflow);
  const progress = calculateWorkflowProgress(reconciled);
  let status = currentStatus;
  if (progress === 100) status = normalizeProjectStatus("completed");
  else if (progress > 0) status = normalizeProjectStatus("in_progress");

  await updateProject(projectId, { workflow: reconciled, progress, status });
}

export async function updateWorkflowNode(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  patch: WorkflowNodePatch,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = patchWorkflowNode(workflow, nodeId, patch);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function toggleWorkflowTask(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  taskId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const node = workflow.find(n => n.id === nodeId);
  const stepTitle = node ? node.title : "unknown step";
  const task = (node && node.type === "checklist")
    ? (node as ChecklistWorkflowNode).tasks.find(t => t.id === taskId)
    : undefined;
  const taskTitle = task ? task.title : "unknown task";
  const wasCompleted = task ? task.completed : false;
  const actionType = wasCompleted ? "incomplete_task" : "complete_task";
  const description = `${wasCompleted ? "Marked incomplete" : "Completed"} task "${taskTitle}" in step "${stepTitle}"`;

  const updated = applyWorkflowTaskToggle(workflow, nodeId, taskId);
  await saveWorkflow(projectId, updated, projectStatus);
  await writeAuditLog(projectId, actionType, description, stepTitle);
}

export async function toggleWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const node = workflow.find(n => n.id === nodeId);
  const stepTitle = node ? node.title : "unknown step";
  const wasCompleted = node ? node.completed : false;
  const actionType = wasCompleted ? "incomplete_step" : "complete_step";
  const description = `${wasCompleted ? "Marked incomplete" : "Completed"} step "${stepTitle}"`;

  const updated = applyWorkflowStepToggle(workflow, nodeId);
  await saveWorkflow(projectId, updated, projectStatus);
  await writeAuditLog(projectId, actionType, description, stepTitle);
}

export async function toggleWorkflowLightCategory(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  categoryId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = toggleLightCategory(workflow, nodeId, categoryId);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function addWorkflowCustomStep(
  projectId: string,
  workflow: WorkflowNode[],
  insertAfterNodeId: string | null,
  step: {
    title: string;
    type: WorkflowNode["type"];
    description?: string;
    taskTitles?: string[];
  },
  projectStatus: Project["status"]
): Promise<void> {
  const updated = addCustomStep(workflow, insertAfterNodeId, step);
  await saveWorkflow(projectId, updated, projectStatus);
  await writeAuditLog(projectId, "add_step", `Added custom step "${step.title}"`, step.title);
}

export async function deleteWorkflowCustomStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const node = workflow.find(n => n.id === nodeId);
  const stepTitle = node ? node.title : "unknown step";

  const updated = deleteCustomStep(workflow, nodeId);
  await saveWorkflow(projectId, updated, projectStatus);
  await writeAuditLog(projectId, "delete_step", `Deleted step "${stepTitle}"`, stepTitle);
}

export async function reorderWorkflowSteps(
  projectId: string,
  workflow: WorkflowNode[],
  activeId: string,
  overId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = reorderWorkflow(workflow, activeId, overId);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function deleteProject(id: string): Promise<void> {
  const currentUser = auth.currentUser;
  const deletedByName = currentUser ? (currentUser.displayName || currentUser.email || "Unknown User") : "Unknown User";

  await updateDoc(doc(db, COLLECTION, id), {
    deleted: true,
    deletedAt: Timestamp.now(),
    deletedBy: deletedByName,
    updatedAt: Timestamp.now()
  });

  await writeAuditLog(id, "delete_project", `Project moved to recycle bin`);
}

export async function permanentlyDeleteProject(id: string): Promise<void> {
  await writeAuditLog(id, "permanent_delete_project", `Project permanently deleted`);
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function restoreFromRecycleBin(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    deleted: false,
    deletedAt: deleteField(),
    deletedBy: deleteField(),
    updatedAt: Timestamp.now()
  });

  await writeAuditLog(id, "restore_deleted_project", `Project restored from recycle bin`);
}

export interface ProjectPhoto {
  id: string;
  url: string;
  publicId: string;
  uploadedAt: string;
  uploadedBy: string;
}

export function subscribeToProjectPhotos(
  projectId: string,
  callback: (photos: ProjectPhoto[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "projects", projectId, "photos"),
    orderBy("uploadedAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const photos = snapshot.docs.map((doc) => {
      const data = doc.data();
      let uploadedAt = "";
      if (data.uploadedAt && typeof data.uploadedAt === "object" && "toDate" in data.uploadedAt) {
        uploadedAt = (data.uploadedAt as { toDate: () => Date }).toDate().toISOString();
      } else if (typeof data.uploadedAt === "string") {
        uploadedAt = data.uploadedAt;
      }
      return {
        id: doc.id,
        url: String(data.url ?? ""),
        publicId: String(data.publicId ?? ""),
        uploadedAt,
        uploadedBy: String(data.uploadedBy ?? ""),
      };
    });
    callback(photos);
  });
}

export async function addProjectPhoto(
  projectId: string,
  url: string,
  publicId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  const uploadedByName = currentUser ? (currentUser.displayName || currentUser.email || "Unknown User") : "Unknown User";

  await addDoc(collection(db, "projects", projectId, "photos"), {
    url,
    publicId,
    uploadedAt: Timestamp.now(),
    uploadedBy: uploadedByName,
  });

  await writeAuditLog(projectId, "upload_photo", `Uploaded site photo`);
}

export async function deleteProjectPhoto(
  projectId: string,
  photoId: string
): Promise<void> {
  await deleteDoc(doc(db, "projects", projectId, "photos", photoId));
  await writeAuditLog(projectId, "delete_photo", `Deleted site photo`);
}
