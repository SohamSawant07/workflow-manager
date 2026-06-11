import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Content } from "@google/generative-ai";
import { GALAXY_STATIC_CONTEXT } from "@/lib/sopContext";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { fetchAuditLogs } from "@/lib/firestore/audit";
import { db } from "@/lib/firebase";

// ── Query type detection ───────────────────────────────────────────────────

type QueryType =
  | "phone" | "address" | "status" | "manager" | "advance"
  | "deadline" | "workflow" | "contacts" | "all" | "update";

function detectProjectQueryType(message: string): QueryType {
  const lower = message.toLowerCase();

  if (["all details", "full details", "sab kuch", "poori detail"].some((p) => lower.includes(p)))
    return "all";
  // "contacts" before "phone" so "contacts"/"site contact" wins over "contact"
  if (["contacts", "site contact", "electrician", "architect", "interior"].some((p) => lower.includes(p)))
    return "contacts";
  if (["phone", "number", "contact", "mobile"].some((p) => lower.includes(p)))
    return "phone";
  if (["address", "location", "where", "site address"].some((p) => lower.includes(p)))
    return "address";
  if (["status", "progress", "kitna hua"].some((p) => lower.includes(p)))
    return "status";
  if (["site manager", "manager", "who is managing"].some((p) => lower.includes(p)))
    return "manager";
  if (["advance", "payment", "amount", "kitna diya"].some((p) => lower.includes(p)))
    return "advance";
  if (["deadline", "completion", "kab tak"].some((p) => lower.includes(p)))
    return "deadline";
  if (["workflow", "steps", "pending", "completed"].some((p) => lower.includes(p)))
    return "workflow";
  return "update";
}

// ── Formatting helpers ─────────────────────────────────────────────────────

type ProjectData = Record<string, unknown>;

function clientLabel(data: ProjectData): string {
  return String(data.clientName || data.name || "Unknown");
}

function statusEmoji(s: string): string {
  const map: Record<string, string> = {
    planning: "🔵", in_progress: "🟡", review: "🟠", completed: "🟢", on_hold: "🔴",
  };
  return map[s] ?? "⚪";
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    planning: "Planning", in_progress: "In Progress",
    review: "In Review", completed: "Completed", on_hold: "On Hold",
  };
  return map[s] ?? s;
}

function formatDeadlineStr(data: ProjectData): string {
  if (!data.deadline) return "No deadline set";
  const raw = data.deadline as any;
  const d = raw?.toDate ? raw.toDate() : new Date(String(raw));
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "number") return `₹${value.toLocaleString("en-IN")}`;
  return String(value);
}

function getAdvanceAmountFromWorkflow(workflow: unknown): number | string | null {
  if (!Array.isArray(workflow)) return null;
  for (const node of workflow) {
    if (!node || typeof node !== "object") continue;
    const n = node as { key?: string; title?: string; amount?: number | string | null; value?: unknown };
    const key = String(n.key ?? "").toLowerCase();
    const title = String(n.title ?? "").toLowerCase();
    if (key !== "advance_received" && !title.includes("advance received")) continue;
    if (n.amount !== undefined && n.amount !== null && n.amount !== "") return n.amount;
    if (typeof n.value === "number" || typeof n.value === "string") return n.value;
  }
  return null;
}

function contactIcon(designation: string): string {
  const d = designation.toLowerCase();
  if (d.includes("architect") || d.includes("interior")) return "🏗️";
  if (d.includes("electrician")) return "⚡";
  if (d.includes("plumber")) return "🔧";
  if (d.includes("manager")) return "👷";
  return "👤";
}

// ── Per-type formatters ────────────────────────────────────────────────────

function fmtPhone(data: ProjectData): string {
  const phone = String(data.clientPhone || "");
  return [
    `## ${clientLabel(data)}`,
    phone ? `📞 **Phone:** ${phone}` : "_No phone number recorded._",
  ].join("\n");
}

function fmtAddress(data: ProjectData): string {
  const parts = [data.address, data.city, data.landmark ? `near ${data.landmark}` : null]
    .filter(Boolean)
    .map(String);
  const full = parts.join(", ") || null;
  const lines = [`## ${clientLabel(data)}`];
  if (full) lines.push(`📍 **Address:** ${full}`);
  else lines.push("_No address recorded._");
  if (data.googleMapsLink) lines.push(`🗺️ [Open in Maps](${data.googleMapsLink})`);
  return lines.join("\n");
}

function fmtStatus(data: ProjectData): string {
  const s = String(data.status ?? "planning");
  return [
    `## ${clientLabel(data)}`,
    `**Status:** ${statusEmoji(s)} ${statusLabel(s)}`,
    data.progress !== undefined ? `**Progress:** ${data.progress}%` : null,
  ].filter(Boolean).join("\n");
}

function fmtManager(data: ProjectData): string {
  const mgr = String(data.siteManagerName || "");
  return [
    `## ${clientLabel(data)}`,
    mgr ? `👷 **Site Manager:** ${mgr}` : "_No site manager recorded._",
  ].join("\n");
}

function fmtAdvance(data: ProjectData): string {
  const amt = (data.amount as number | string | null | undefined)
    ?? getAdvanceAmountFromWorkflow(data.workflow);
  return [
    `## ${clientLabel(data)}`,
    `💰 **Advance Received:** ${formatAmount(amt)}`,
  ].join("\n");
}

function fmtDeadline(data: ProjectData): string {
  return [
    `## ${clientLabel(data)}`,
    `📅 **Deadline:** ${formatDeadlineStr(data)}`,
  ].join("\n");
}

function fmtWorkflow(data: ProjectData): string {
  const lines = [`## ${clientLabel(data)}`, "", "### Workflow Steps"];
  if (!Array.isArray(data.workflow) || data.workflow.length === 0) {
    lines.push("_No workflow steps defined._");
    return lines.join("\n");
  }
  for (const node of data.workflow as any[]) {
    if (!node) continue;
    const title = String(node.title ?? node.key ?? "Unnamed step");
    const icon = node.completed ? "✅" : "⏳";
    const amt = node.amount ?? (typeof node.value === "number" ? node.value : null);
    const amtStr = amt !== null && amt !== undefined ? ` — ₹${Number(amt).toLocaleString("en-IN")}` : "";
    lines.push(`- ${icon} ${title}${amtStr}`);
  }
  return lines.join("\n");
}

function fmtContacts(data: ProjectData): string {
  const lines = [`## ${clientLabel(data)}`, "", "### Site Contacts"];
  if (data.siteManagerName) {
    lines.push(`👷 **Site Manager:** ${data.siteManagerName}`);
  }
  const contacts = Array.isArray(data.siteContacts) ? data.siteContacts as { designation: string; name: string; phone: string }[] : [];
  if (contacts.length === 0 && !data.siteManagerName) {
    lines.push("_No contacts recorded._");
  }
  for (const c of contacts) {
    const icon = contactIcon(c.designation || "");
    const label = c.designation || "Contact";
    const namePart = c.name ? c.name : "";
    const phonePart = c.phone ? c.phone : "";
    const detail = [namePart, phonePart].filter(Boolean).join(" — ");
    lines.push(`${icon} **${label}:** ${detail || "_not recorded_"}`);
  }
  return lines.join("\n");
}

function fmtAll(data: ProjectData): string {
  const s = String(data.status ?? "planning");
  const lines: string[] = [`## ${clientLabel(data)}`];

  // Overview line
  lines.push(
    `**Status:** ${statusEmoji(s)} ${statusLabel(s)} | **Progress:** ${data.progress ?? 0}%`
  );
  if (data.siteManagerName) lines.push(`**Site Manager:** ${data.siteManagerName}`);
  if (data.clientPhone) lines.push(`**Phone:** ${data.clientPhone}`);

  // Address
  const addressParts = [data.address, data.city, data.landmark ? `near ${data.landmark}` : null]
    .filter(Boolean).map(String);
  if (addressParts.length) lines.push(`**Address:** ${addressParts.join(", ")}`);

  // Dates
  if (data.startDate) {
    const sd = new Date(String(data.startDate));
    lines.push(`**Start Date:** ${isNaN(sd.getTime()) ? String(data.startDate) : sd.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
  }
  lines.push(`**Deadline:** ${formatDeadlineStr(data)}`);

  // Advance
  const amt = (data.amount as number | string | null | undefined)
    ?? getAdvanceAmountFromWorkflow(data.workflow);
  if (amt !== null && amt !== undefined && amt !== "") {
    lines.push(`**Advance Received:** ${formatAmount(amt)}`);
  }

  // Workflow
  if (Array.isArray(data.workflow) && data.workflow.length > 0) {
    lines.push("", "### Workflow");
    const workflow = data.workflow as any[];
    for (const node of workflow) {
      if (!node) continue;
      const title = String(node.title ?? node.key ?? "Unnamed step");
      const icon = node.completed ? "✅" : "⏳";
      const nodeAmt = node.amount ?? (typeof node.value === "number" ? node.value : null);
      const amtStr = nodeAmt !== null && nodeAmt !== undefined ? ` — ₹${Number(nodeAmt).toLocaleString("en-IN")}` : "";
      lines.push(`- ${icon} ${title}${amtStr}`);
    }
    const completed = workflow.filter((n) => n?.completed);
    const pending = workflow.filter((n) => n && !n.completed);
    const lastDone = completed[completed.length - 1];
    lines.push("");
    if (lastDone) lines.push(`**Last Completed:** ${String(lastDone.title ?? lastDone.key ?? "—")}`);
    if (pending.length > 0) lines.push(`**Pending Steps:** ${pending.length}`);
  }

  return lines.join("\n");
}

function fmtUpdate(data: ProjectData): string {
  const s = String(data.status ?? "planning");
  const lines: string[] = [`## ${clientLabel(data)}`];

  lines.push(
    `**Status:** ${statusEmoji(s)} ${statusLabel(s)} | **Progress:** ${data.progress ?? 0}%`
  );
  if (data.siteManagerName) lines.push(`**Site Manager:** ${data.siteManagerName}`);

  if (Array.isArray(data.workflow) && data.workflow.length > 0) {
    const workflow = data.workflow as any[];
    const completed = workflow.filter((n) => n?.completed);
    const pending = workflow.filter((n) => n && !n.completed);
    const lastDone = completed[completed.length - 1];
    if (lastDone) lines.push(`**Last Completed:** ${String(lastDone.title ?? lastDone.key ?? "—")}`);
    if (pending.length > 0) {
      lines.push(
        `**Pending (${pending.length}):** ${pending.map((n) => String(n.title ?? n.key ?? "?")).join(", ")}`
      );
    }
  }

  return lines.join("\n");
}

function formatByQueryType(type: QueryType, data: ProjectData): string {
  switch (type) {
    case "phone":    return fmtPhone(data);
    case "address":  return fmtAddress(data);
    case "status":   return fmtStatus(data);
    case "manager":  return fmtManager(data);
    case "advance":  return fmtAdvance(data);
    case "deadline": return fmtDeadline(data);
    case "workflow": return fmtWorkflow(data);
    case "contacts": return fmtContacts(data);
    case "all":      return fmtAll(data);
    default:         return fmtUpdate(data);
  }
}

// ── Project keyword detection ──────────────────────────────────────────────

const PROJECT_KEYWORDS = [
  "project", "client", "site", "status", "progress", "stage",
  "manager", "deadline", "address", "city", "phone", "workflow",
  "installation", "completed", "in progress", "pending",
  "advance", "payment", "paid", "invoice", "balance", "received", "due",
  "update", "status update", "what is happening", "progress on",
  "kya chal raha", "latest on", "kya hua", "batao",
];

function isProjectRelated(message: string): boolean {
  const lower = message.toLowerCase();
  return PROJECT_KEYWORDS.some((kw) => lower.includes(kw));
}

function isRecentSentQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("recent") && (lower.includes("sent") || lower.includes("sent to clients"))) ||
    lower.includes("recent things sent") ||
    lower.includes("what was sent to clients") ||
    lower.includes("things sent to clients")
  );
}

// ── Project matching ───────────────────────────────────────────────────────

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "and", "for", "from", "with", "what", "who", "how", "much", "been"].includes(t));
}

function scoreProjectMatch(messageTokens: string[], data: ProjectData): number {
  const fields = [data.name, data.clientName, data.siteManagerName, data.address, data.city, data.landmark]
    .filter(Boolean)
    .map((v) => normalizeTokens(String(v)).join(" "));
  const haystack = new Set(normalizeTokens(fields.join(" ")));
  return messageTokens.reduce((score, token) => score + (haystack.has(token) ? 1 : 0), 0);
}

async function findBestProjectMatch(message: string): Promise<ProjectData | null> {
  const snapshot = await getDocs(query(collection(db, "projects"), orderBy("updatedAt", "desc")));
  if (snapshot.empty) return null;

  const lowerMessage = message.toLowerCase();
  const messageTokens = normalizeTokens(message);
  const rawWords = lowerMessage.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2);

  let best: ProjectData | null = null;
  let bestScore = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as ProjectData;
    if (data.deleted) continue;

    let score = scoreProjectMatch(messageTokens, data);

    const nameFields = [data.name, data.clientName].filter(Boolean).map((v) => String(v).toLowerCase());
    for (const field of nameFields) {
      const fieldWords = field.split(/\s+/).filter((w) => w.length >= 2);
      for (const fw of fieldWords) {
        if (rawWords.includes(fw)) score += 3;
        else if (lowerMessage.includes(fw) && fw.length >= 3) score += 2;
      }
      for (const mw of rawWords) {
        if (mw.length >= 3 && field.includes(mw)) score += 1;
      }
    }

    if (score > bestScore) { bestScore = score; best = data; }
  }

  return bestScore > 0 ? best : null;
}

async function findNamedProjectInMessage(message: string): Promise<ProjectData | null> {
  const snapshot = await getDocs(query(collection(db, "projects"), orderBy("updatedAt", "desc")));
  if (snapshot.empty) return null;

  const lowerMessage = message.toLowerCase();
  const rawWords = lowerMessage.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2);

  for (const doc of snapshot.docs) {
    const data = doc.data() as ProjectData;
    if (data.deleted) continue;

    const nameFields = [data.name, data.clientName].filter(Boolean).map((v) => String(v).toLowerCase());
    for (const field of nameFields) {
      const fieldWords = field.split(/\s+/).filter((w) => w.length >= 2);
      const allWordsMatch = fieldWords.length > 0 && fieldWords.every((fw) => rawWords.includes(fw));
      const fullFieldMatch = lowerMessage.includes(field);
      const singleWordMatch = fieldWords.length === 1 && rawWords.includes(fieldWords[0]);
      if (allWordsMatch || fullFieldMatch || singleWordMatch) return data;
    }
  }
  return null;
}

// ── Audit log helpers ──────────────────────────────────────────────────────

function formatAuditResults(logs: any[], limit = 8): string {
  if (!Array.isArray(logs) || logs.length === 0) return "No recent sent items found.";
  const keywords = ["send", "sent", "email", "invoice", "shared", "delivered"];
  const filtered = logs.filter((l) => {
    const desc = (l.description || "").toLowerCase();
    const type = (l.actionType || "").toLowerCase();
    return keywords.some((k) => desc.includes(k) || type.includes(k));
  });
  return (filtered.length ? filtered : logs).slice(0, limit).map((l) => {
    const time = l.timestamp instanceof Date ? l.timestamp.toISOString().split("T")[0] : String(l.timestamp);
    return `- [${time}] ${l.projectName}: ${l.description}`;
  }).join("\n");
}

// ── All-projects fallback context for LLM ─────────────────────────────────

async function fetchAllProjectsContext(message: string): Promise<string> {
  try {
    const snapshot = await getDocs(query(collection(db, "projects"), orderBy("updatedAt", "desc")));
    if (snapshot.empty) return "No projects found.";

    const lowerMessage = message.toLowerCase();
    const lines: string[] = ["Current Projects in Galaxy System:\n"];

    for (const doc of snapshot.docs) {
      const d = doc.data();
      if (d.deleted) continue;
      const nameMatch = String(d.name ?? "").toLowerCase();
      const clientMatch = String(d.clientName ?? "").toLowerCase();
      if (
        message.length > 5 &&
        nameMatch && !lowerMessage.includes(nameMatch) &&
        clientMatch && !lowerMessage.includes(clientMatch)
      ) continue;

      lines.push(`Project: ${d.name || "Unnamed"}`);
      if (d.clientName) lines.push(`  Client: ${d.clientName}`);
      if (d.status) lines.push(`  Status: ${d.status}`);
      if (d.progress !== undefined) lines.push(`  Progress: ${d.progress}%`);
      if (d.siteManagerName) lines.push(`  Site Manager: ${d.siteManagerName}`);
      if (d.clientPhone) lines.push(`  Phone: ${d.clientPhone}`);
      if (d.city) lines.push(`  City: ${d.city}`);
      if (d.address) lines.push(`  Address: ${d.address}`);
      if (d.deadline) lines.push(`  Deadline: ${d.deadline?.toDate ? d.deadline.toDate().toLocaleDateString("en-IN") : d.deadline}`);
      const advAmt = getAdvanceAmountFromWorkflow(d.workflow);
      if (advAmt !== null) lines.push(`  Advance Received: ${formatAmount(advAmt)}`);
      lines.push("");
    }

    return lines.join("\n");
  } catch {
    return "Unable to fetch project data at this time.";
  }
}

// ── LLM generators ────────────────────────────────────────────────────────

type HistoryEntry = { role: "user" | "bot"; content: string };

async function generateWithGemini(message: string, systemPrompt: string, history: HistoryEntry[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const modelsToTry = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];

  const geminiHistory: Content[] = history.flatMap((entry): Content[] => ([
    entry.role === "user"
      ? { role: "user", parts: [{ text: entry.content }] }
      : { role: "model", parts: [{ text: entry.content }] },
  ]));

  let result: any = null;
  for (const modelName of modelsToTry) {
    const modelRef = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
    const chat = modelRef.startChat({ history: geminiHistory });
    try {
      let attempt = 0;
      while (attempt < 3) {
        try { result = await chat.sendMessage(message); break; }
        catch (err: any) {
          attempt++;
          const msg = err?.message || String(err);
          if (msg.includes("404") || /not found/i.test(msg)) throw err;
          if (attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }
      break;
    } catch (err: any) {
      if (/not found|404/i.test(err?.message || String(err))) continue;
      throw err;
    }
  }

  if (!result) throw new Error("All configured Gemini models failed");
  return result.response?.text ? result.response.text() : String(result);
}

async function generateWithOllama(message: string, systemPrompt: string, history: HistoryEntry[] = []): Promise<string> {
  const tunnelUrl = process.env.OLLAMA_TUNNEL_URL;
  if (!tunnelUrl) throw new Error("OLLAMA_TUNNEL_URL not configured");

  const historySection = history.length > 0
    ? history.map((e) => (e.role === "user" ? `User: ${e.content}` : `Assistant: ${e.content}`)).join("\n")
    : null;

  const fullPrompt = [
    (historySection
      ? "You are SOP-Bot. You can also answer questions about the current conversation history. If the user asks about previous messages, summarize them.\n\n"
      : "") + systemPrompt,
    historySection ? `Previous conversation:\n${historySection}` : null,
    `User question: ${message}`,
  ].filter(Boolean).join("\n\n");

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
  return (await res.json()).response;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, model, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const answeredBy = model === "ollama" ? "ollama" : "gemini";

    // 1. Named-project first-pass: if message contains a known project/client name,
    //    return formatted data immediately without hitting the LLM.
    const namedProject = await findNamedProjectInMessage(message);
    if (namedProject) {
      const queryType = detectProjectQueryType(message);
      return NextResponse.json({
        answer: formatByQueryType(queryType, namedProject),
        source: "Live Project Data",
        answeredBy,
      });
    }

    // 2. Recent sent-items query
    if (isRecentSentQuery(message)) {
      try {
        const logs = await fetchAuditLogs();
        return NextResponse.json({
          answer: `## Recent Items Sent to Clients\n\n${formatAuditResults(logs, 10)}`,
          source: "Audit Logs",
          answeredBy,
        });
      } catch (e) {
        console.error("Failed to fetch audit logs:", e);
      }
    }

    // 3. Generic project-related query: find best fuzzy match and format
    if (isProjectRelated(message)) {
      const project = await findBestProjectMatch(message);
      if (project) {
        const queryType = detectProjectQueryType(message);
        return NextResponse.json({
          answer: formatByQueryType(queryType, project),
          source: "Live Project Data",
          answeredBy,
        });
      }
    }

    // 4. Fall through to LLM with optional project context injected into system prompt
    let dynamicContext = "";
    let source = "Galaxy SOP Knowledge Base";

    if (isProjectRelated(message)) {
      dynamicContext = await fetchAllProjectsContext(message);
      source = "Galaxy SOP Knowledge Base + Live Project Data";
    }

    const systemPrompt = `You are SOP-Bot, an internal assistant for Galaxy Home Automation LLP — a home automation company in Mumbai working exclusively with Zigbee protocol. You help staff answer questions about company SOPs, pricing, warranties, installation procedures, and live project data.

Always be concise, accurate, and professional. If you don't know something, say so clearly. Format responses in clean markdown.

${GALAXY_STATIC_CONTEXT}
${dynamicContext ? `\n---\nLIVE PROJECT DATA:\n${dynamicContext}` : ""}`;

    let answer: string;
    if (model === "ollama") {
      try {
        answer = await generateWithOllama(message, systemPrompt, history);
      } catch (ollamaErr) {
        console.error("Ollama failed, falling back to Gemini:", ollamaErr);
        answer = await generateWithGemini(message, systemPrompt, history);
        source += " (Ollama unavailable, used Gemini)";
      }
    } else {
      answer = await generateWithGemini(message, systemPrompt, history);
    }

    return NextResponse.json({ answer, source, answeredBy });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
