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
import { db } from "@/lib/firebase";
import type { Project, ProjectCreateInput } from "@/types";
import type { ProjectCreator } from "@/types/auth";
import type {
  WorkflowNode,
  WorkflowNodePatch,
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
  deleteWorkflowNode as applyDeleteWorkflowNode,
  reorderWorkflowNodes,
  unlockWorkflowNode as applyUnlockWorkflowNode,
  relockWorkflowNode as applyRelockWorkflowNode,
} from "@/lib/workflow/mutations";
import { reconcileWorkflow } from "@/lib/workflow/pipeline";
import { calculateWorkflowProgress } from "@/lib/workflow/progress";

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
  const document = buildFirestoreProjectDocument(input, creator);
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
    startDate: document.startDate,
    createdAt: now,
    updatedAt: now,
  });

  const docRef = await addDoc(collection(db, COLLECTION), docData);
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

  if (fields.startDate !== undefined) payload.startDate = fields.startDate;

  await updateDoc(doc(db, COLLECTION, id), payload);
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
  const updated = applyWorkflowTaskToggle(workflow, nodeId, taskId);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function toggleWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = applyWorkflowStepToggle(workflow, nodeId);
  await saveWorkflow(projectId, updated, projectStatus);
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

export async function addCustomWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  insertAfterIndex: number,
  title: string,
  notes: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = addCustomStep(workflow, insertAfterIndex, title, notes);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function deleteWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = applyDeleteWorkflowNode(workflow, nodeId);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function reorderWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  direction: "up" | "down",
  projectStatus: Project["status"]
): Promise<void> {
  const updated = reorderWorkflowNodes(workflow, nodeId, direction);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function unlockWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = applyUnlockWorkflowNode(workflow, nodeId);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function relockWorkflowStep(
  projectId: string,
  workflow: WorkflowNode[],
  nodeId: string,
  projectStatus: Project["status"]
): Promise<void> {
  const updated = applyRelockWorkflowNode(workflow, nodeId);
  await saveWorkflow(projectId, updated, projectStatus);
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
