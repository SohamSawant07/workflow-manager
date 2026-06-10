import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GALAXY_STATIC_CONTEXT } from "@/lib/sopContext";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { fetchAuditLogs } from "@/lib/firestore/audit";
import { db } from "@/lib/firebase";

const PROJECT_KEYWORDS = [
  "project", "client", "site", "status", "progress", "stage",
  "manager", "deadline", "address", "city", "phone", "workflow",
  "installation", "completed", "in progress", "pending",
  "advance", "payment", "paid", "invoice", "balance", "received", "due",
  "update", "status update", "what is happening", "progress on",
  "kya chal raha", "latest on", "kya hua", "batao",
];

const PROJECT_UPDATE_PHRASES = [
  "update on", "status update", "status of", "what is happening with",
  "what's happening with", "progress on", "latest on", "kya chal raha",
  "kya hua", "batao", "what is update", "whats the update",
];

function isProjectRelated(message: string): boolean {
  const lower = message.toLowerCase();
  return PROJECT_KEYWORDS.some((kw) => lower.includes(kw));
}

function isProjectUpdateQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PROJECT_UPDATE_PHRASES.some((phrase) => lower.includes(phrase));
}

function isAdvanceQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return ["advance", "amount", "received", "payment", "paid", "balance", "invoice"].some((kw) =>
    lower.includes(kw)
  );
}

function isProjectDetailsQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("all details") ||
    lower.includes("details of") ||
    lower.startsWith("give me details") ||
    lower.startsWith("give me all details") ||
    lower.includes("show details") ||
    lower.includes("tell me about")
  );
}

function isRecentSentQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("recent") && (lower.includes("sent") || lower.includes("sent to") || lower.includes("sent clients") || lower.includes("sent to clients")) ||
    lower.includes("recent things sent") ||
    lower.includes("recent items sent") ||
    lower.includes("what was sent to clients") ||
    lower.includes("things sent to clients")
  );
}

function formatAuditResults(logs: any[], limitResults = 8): string {
  if (!Array.isArray(logs) || logs.length === 0) return "No recent sent items found.";

  const keywords = ["send", "sent", "email", "invoice", "shared", "delivered", "sent to client", "sent to clients"];
  const filtered = logs.filter((l) => {
    const desc = (l.description || "").toLowerCase();
    const type = (l.actionType || "").toLowerCase();
    return keywords.some((k) => desc.includes(k) || type.includes(k));
  });

  const items = (filtered.length ? filtered : logs).slice(0, limitResults).map((l) => {
    const time = l.timestamp instanceof Date ? l.timestamp.toISOString().split("T")[0] : String(l.timestamp);
    return `- [${time}] ${l.projectName}: ${l.description}`;
  });

  return items.join("\n");
}

function formatProjectSummary(data: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Project: ${String(data.name ?? "Unnamed")}`);
  if (data.clientName) lines.push(`Client: ${String(data.clientName)}`);
  if (data.siteManagerName) lines.push(`Site Manager: ${String(data.siteManagerName)}`);
  if (data.city) lines.push(`City: ${String(data.city)}`);
  if (data.address) lines.push(`Address: ${String(data.address)}`);
  if (data.clientPhone) lines.push(`Phone: ${String(data.clientPhone)}`);
  if (data.status) lines.push(`Status: ${String(data.status)}`);
  if (data.progress !== undefined) lines.push(`Progress: ${String(data.progress)}%`);
  if (data.amount !== undefined && data.amount !== null && data.amount !== "") {
    lines.push(`Amount: ${formatAmount(data.amount as number | string)}`);
  }

  // workflow
  if (Array.isArray(data.workflow)) {
    lines.push("Workflow:");
    for (const node of data.workflow as any[]) {
      if (!node || typeof node !== "object") continue;
      const title = node.title ?? node.key ?? "Unnamed step";
      const completed = node.completed ? "completed" : "pending";
      const amt = node.amount ?? node.value ?? null;
      lines.push(`- ${String(title)}: ${completed}${amt ? ` — amount: ${formatAmount(amt)}` : ""}`);
    }
  }

  return lines.join("\n");
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !["the", "and", "for", "from", "with", "what", "who", "how", "much", "been"].includes(token));
}

function getAdvanceAmountFromWorkflow(workflow: unknown): number | string | null {
  if (!Array.isArray(workflow)) return null;

  for (const node of workflow) {
    if (!node || typeof node !== "object") continue;
    const workflowNode = node as {
      key?: string;
      title?: string;
      amount?: number | string | null;
      value?: unknown;
    };
    const key = String(workflowNode.key ?? "").toLowerCase();
    const title = String(workflowNode.title ?? "").toLowerCase();
    if (key !== "advance_received" && !title.includes("advance received")) continue;

    if (workflowNode.amount !== undefined && workflowNode.amount !== null && workflowNode.amount !== "") {
      return workflowNode.amount;
    }
    if (typeof workflowNode.value === "number" || typeof workflowNode.value === "string") {
      return workflowNode.value;
    }
  }

  return null;
}

function scoreProjectMatch(messageTokens: string[], data: Record<string, unknown>): number {
  const fields = [data.name, data.clientName, data.siteManagerName, data.address, data.city, data.landmark]
    .filter(Boolean)
    .map((value) => normalizeTokens(String(value)).join(" "));

  const haystack = normalizeTokens(fields.join(" "));
  const hayset = new Set(haystack);
  return messageTokens.reduce((score, token) => score + (hayset.has(token) ? 1 : 0), 0);
}

async function findBestProjectMatch(message: string): Promise<Record<string, unknown> | null> {
  const q = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const lowerMessage = message.toLowerCase();
  const messageTokens = normalizeTokens(message);
  // Also keep raw message words (no stopword stripping) for short tokens like "KNX"
  const rawMessageWords = lowerMessage
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  let best: Record<string, unknown> | null = null;
  let bestScore = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.deleted) continue;

    let score = scoreProjectMatch(messageTokens, data);

    // Fuzzy boost: check every word in the project's name and clientName
    // against every raw word in the message (catches short tokens like "KNX")
    const nameFields = [data.name, data.clientName]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    for (const field of nameFields) {
      const fieldWords = field.split(/\s+/).filter((w) => w.length >= 2);
      for (const fw of fieldWords) {
        // field word appears in message → strong signal
        if (rawMessageWords.includes(fw)) score += 3;
        // partial: message contains field word as substring
        else if (lowerMessage.includes(fw) && fw.length >= 3) score += 2;
      }
      for (const mw of rawMessageWords) {
        // message word appears as substring of field (e.g. "rohit" in "rohit knx")
        if (mw.length >= 3 && field.includes(mw)) score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = data;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Returns true when the message appears to be asking about a specific
 * project/client by name — even without explicit intent keywords.
 * Used for the first-pass check that fires before SOP routing.
 */
async function findNamedProjectInMessage(message: string): Promise<Record<string, unknown> | null> {
  const q = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const lowerMessage = message.toLowerCase();
  const rawWords = lowerMessage
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.deleted) continue;

    const nameFields = [data.name, data.clientName]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    for (const field of nameFields) {
      const fieldWords = field.split(/\s+/).filter((w) => w.length >= 2);
      // Require ALL words in the field to appear in the message,
      // OR the full field string to be a substring of the message.
      const allWordsMatch = fieldWords.length > 0 && fieldWords.every((fw) => rawWords.includes(fw));
      const fullFieldMatch = lowerMessage.includes(field);
      // Single-word project names: match if the one word appears in message
      const singleWordMatch = fieldWords.length === 1 && rawWords.includes(fieldWords[0]);

      if (allWordsMatch || fullFieldMatch || singleWordMatch) {
        return data;
      }
    }
  }
  return null;
}

function summarizeAdvanceFromWorkflow(workflow: unknown): string[] {
  if (!Array.isArray(workflow)) return [];

  const lines: string[] = [];
  for (const node of workflow) {
    if (!node || typeof node !== "object") continue;
    const workflowNode = node as {
      key?: string;
      title?: string;
      completed?: boolean;
      amount?: number | null;
      value?: unknown;
      notes?: string;
    };

    const key = String(workflowNode.key ?? "").toLowerCase();
    const title = String(workflowNode.title ?? "").toLowerCase();
    if (key !== "advance_received" && !title.includes("advance received")) continue;

    const amount = workflowNode.amount ?? (typeof workflowNode.value === "number" ? workflowNode.value : null);
    const status = workflowNode.completed ? "completed" : "pending";
    lines.push(`  Advance Received: ${amount !== null && amount !== undefined ? `₹${amount}` : "not recorded"} (${status})`);
    if (workflowNode.notes) lines.push(`  Advance Notes: ${workflowNode.notes}`);
  }

  return lines;
}

async function fetchAllProjects(message: string): Promise<string> {
  try {
    const q = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return "No projects found in the database.";

    const lowerMessage = message.toLowerCase();
    const matchedDocs = snapshot.docs.filter((doc) => {
      const d = doc.data();
      const name = String(d.name ?? "").toLowerCase();
      const clientName = String(d.clientName ?? "").toLowerCase();
      return name && lowerMessage.includes(name) || clientName && lowerMessage.includes(clientName);
    });

    const docsToReport = matchedDocs.length > 0 ? matchedDocs : snapshot.docs;
    const lines: string[] = [matchedDocs.length > 0 ? "Matching Project Data:\n" : "Current Projects in Galaxy System:\n"];
    snapshot.docs.forEach((doc) => {
      if (matchedDocs.length > 0 && !docsToReport.includes(doc)) return;
      const d = doc.data();
      if (d.deleted) return;
      lines.push(`Project: ${d.name || "Unnamed"}`);
      if (d.clientName) lines.push(`  Client: ${d.clientName}`);
      if (d.city) lines.push(`  City: ${d.city}`);
      if (d.address) lines.push(`  Address: ${d.address}`);
      if (d.clientPhone) lines.push(`  Phone: ${d.clientPhone}`);
      if (d.status) lines.push(`  Status: ${d.status}`);
      if (d.progress !== undefined) lines.push(`  Progress: ${d.progress}%`);
      if (d.siteManagerName) lines.push(`  Site Manager: ${d.siteManagerName}`);
      if (d.startDate) lines.push(`  Start Date: ${d.startDate}`);
      if (d.amount !== undefined && d.amount !== null && d.amount !== "") {
        lines.push(`  Amount: ${typeof d.amount === "number" ? `₹${d.amount}` : d.amount}`);
      }
      lines.push(...summarizeAdvanceFromWorkflow(d.workflow));
      if (d.deadline) {
        const deadline = d.deadline?.toDate ? d.deadline.toDate().toLocaleDateString("en-IN") : d.deadline;
        lines.push(`  Deadline: ${deadline}`);
      }
      lines.push("");
    });
    return lines.join("\n");
  } catch {
    return "Unable to fetch project data at this time.";
  }
}

function formatProjectUpdate(data: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`**${String(data.name ?? "Unnamed")}**`);
  if (data.clientName) lines.push(`**Client:** ${String(data.clientName)}`);
  if (data.siteManagerName) lines.push(`**Site Manager:** ${String(data.siteManagerName)}`);
  if (data.status) lines.push(`**Status:** ${String(data.status)}`);
  if (data.progress !== undefined) lines.push(`**Progress:** ${String(data.progress)}%`);
  if (data.startDate) lines.push(`**Start Date:** ${String(data.startDate)}`);
  if (data.deadline) {
    const deadline = (data.deadline as any)?.toDate
      ? (data.deadline as any).toDate().toLocaleDateString("en-IN")
      : String(data.deadline);
    lines.push(`**Deadline:** ${deadline}`);
  }
  if (data.address) lines.push(`**Address:** ${String(data.address)}`);

  if (Array.isArray(data.workflow)) {
    const workflow = data.workflow as any[];
    const completed = workflow.filter((n) => n?.completed);
    const pending = workflow.filter((n) => n && !n.completed);
    const lastDone = completed[completed.length - 1];
    if (lastDone) lines.push(`**Last completed step:** ${String(lastDone.title ?? lastDone.key ?? "—")}`);
    if (pending.length > 0) {
      lines.push(`**Pending steps (${pending.length}):** ${pending.map((n) => String(n.title ?? n.key ?? "?")).join(", ")}`);
    }
  }

  return lines.join("\n");
}

function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "not recorded";
  if (typeof value === "number") return `₹${value}`;
  return String(value);
}

type HistoryEntry = { role: "user" | "bot"; content: string };

async function generateWithGemini(message: string, systemPrompt: string, history: HistoryEntry[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const modelsToTry = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];

  async function generateWithRetry(modelRef: any, chat: any, maxAttempts = 3) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return await chat.sendMessage(message);
      } catch (err: any) {
        attempt++;
        const errMsg = err?.message || String(err);
        if (errMsg.includes("404") || /not found/i.test(errMsg)) throw err;
        if (attempt >= maxAttempts) throw err;
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // Build Gemini chat history from conversation history (exclude last user message, that's sent via sendMessage)
  const geminiHistory = history.flatMap((entry) => {
    if (entry.role === "user") {
      return [{ role: "user" as const, parts: [{ text: entry.content }] }];
    } else {
      return [{ role: "model" as const, parts: [{ text: entry.content }] }];
    }
  });

  let result: any = null;
  for (const modelName of modelsToTry) {
    const modelRef = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
    const chat = modelRef.startChat({ history: geminiHistory });
    try {
      result = await generateWithRetry(modelRef, chat);
      break;
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/not found|404/i.test(msg)) continue;
      throw err;
    }
  }

  if (!result) throw new Error("All configured Gemini models failed or were not found");
  return result.response?.text ? result.response.text() : String(result);
}

async function generateWithOllama(message: string, systemPrompt: string, history: HistoryEntry[] = []): Promise<string> {
  const tunnelUrl = process.env.OLLAMA_TUNNEL_URL;
  if (!tunnelUrl) throw new Error("OLLAMA_TUNNEL_URL not configured");

  const historySection = history.length > 0
    ? history.map((e) => (e.role === "user" ? `User: ${e.content}` : `Assistant: ${e.content}`)).join("\n")
    : null;

  const historyAwareInstruction = historySection
    ? `You are SOP-Bot. You can also answer questions about the current conversation history. If the user asks about previous messages, summarize them. Only redirect to Krish/Ketan for questions not covered in SOPs AND not in conversation history.\n\n`
    : "";

  const fullPrompt = [
    historyAwareInstruction + systemPrompt,
    historySection ? `Previous conversation:\n${historySection}` : null,
    `User question: ${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const res = await fetch(`${tunnelUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3:8b",
      prompt: fullPrompt,
      stream: false,
      options: { num_predict: 600, temperature: 0.7, num_ctx: 8192 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return data.response;
}

export async function POST(req: NextRequest) {
  try {
    const { message, model, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    let dynamicContext = "";
    let source = "Galaxy SOP Knowledge Base";

    // ── First-pass: if the message contains a known project/client name,
    //    return project data immediately — before any SOP/protocol keyword checks.
    //    This prevents names like "Rohit KNX" from being misread as protocol queries.
    const namedProject = await findNamedProjectInMessage(message);
    if (namedProject) {
      const update = isAdvanceQuery(message)
        ? (() => {
            const amt =
              (namedProject.amount as number | string | null | undefined) ??
              getAdvanceAmountFromWorkflow(namedProject.workflow);
            const n = String(namedProject.name ?? "Unnamed");
            const c = String(namedProject.clientName ?? "");
            return amt !== null && amt !== undefined && amt !== ""
              ? `${n}${c ? ` (${c})` : ""} advance amount: ${formatAmount(amt)}.`
              : `${n}${c ? ` (${c})` : ""} does not have an advance amount recorded yet.`;
          })()
        : isProjectDetailsQuery(message)
        ? formatProjectSummary(namedProject)
        : formatProjectUpdate(namedProject);

      return NextResponse.json({
        answer: update,
        source: "Live Project Data",
        answeredBy: model === "ollama" ? "ollama" : "gemini",
      });
    }

    if (isAdvanceQuery(message)) {
      const project = await findBestProjectMatch(message);
      if (project) {
        const projectAmount = project.amount as number | string | null | undefined;
        const amount = projectAmount ?? getAdvanceAmountFromWorkflow(project.workflow);
        const projectName = String(project.name ?? "Unnamed");
        const clientName = String(project.clientName ?? "");

        if (amount !== null && amount !== undefined && amount !== "") {
          return NextResponse.json({
            answer: `${projectName}${clientName ? ` (${clientName})` : ""} advance amount: ${formatAmount(amount)}.`,
            source: "Live Project Data",
            answeredBy: model === "ollama" ? "ollama" : "gemini",
          });
        }

        return NextResponse.json({
          answer: `${projectName}${clientName ? ` (${clientName})` : ""} does not have an advance amount recorded yet.`,
          source: "Live Project Data",
          answeredBy: model === "ollama" ? "ollama" : "gemini",
        });
      }
    }

    if (isRecentSentQuery(message)) {
      try {
        const logs = await fetchAuditLogs();
        const body = formatAuditResults(logs, 10);
        return NextResponse.json({
          answer: `Recent items sent to clients:\n${body}`,
          source: "Audit Logs",
          answeredBy: model === "ollama" ? "ollama" : "gemini",
        });
      } catch (e) {
        console.error("Failed to fetch audit logs for sent-items query:", e);
      }
    }

    if (isProjectDetailsQuery(message)) {
      const project = await findBestProjectMatch(message);
      if (project) {
        const summary = formatProjectSummary(project);
        return NextResponse.json({
          answer: summary,
          source: "Live Project Data",
          answeredBy: model === "ollama" ? "ollama" : "gemini",
        });
      }
    }

    if (isProjectUpdateQuery(message)) {
      const project = await findBestProjectMatch(message);
      if (project) {
        const update = formatProjectUpdate(project);
        return NextResponse.json({
          answer: update,
          source: "Live Project Data",
          answeredBy: model === "ollama" ? "ollama" : "gemini",
        });
      }
    }

    if (isProjectRelated(message)) {
      dynamicContext = await fetchAllProjects(message);
      source = "Galaxy SOP Knowledge Base + Live Project Data";
    }

    const systemPrompt = `You are SOP-Bot, an internal assistant for Galaxy Home Automation LLP — a home automation company in Mumbai working exclusively with Zigbee protocol. You help staff answer questions about company SOPs, pricing, warranties, installation procedures, and live project data.

Always be concise, accurate, and professional. If you don't know something, say so clearly.

${GALAXY_STATIC_CONTEXT}

${dynamicContext ? `\n---\nLIVE PROJECT DATA (fetched in real-time):\n${dynamicContext}` : ""}`;

    let answer: string;
    let answeredBy: "gemini" | "ollama" = "gemini";

    if (model === "ollama") {
      try {
        answer = await generateWithOllama(message, systemPrompt, history);
        answeredBy = "ollama";
      } catch (ollamaErr) {
        console.error("Ollama failed, falling back to Gemini:", ollamaErr);
        answer = await generateWithGemini(message, systemPrompt, history);
        answeredBy = "gemini";
        source += " (Ollama unavailable, used Gemini)";
      }
    } else {
      answer = await generateWithGemini(message, systemPrompt, history);
      answeredBy = "gemini";
    }

    return NextResponse.json({ answer, source, answeredBy });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
