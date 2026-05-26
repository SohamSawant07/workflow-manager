import { Timestamp, type FieldValue } from "firebase/firestore";

const FIRESTORE_DEFAULTS: Record<string, unknown> = {
  deadline: null,
  notes: "",
  description: "",
  value: null,
  completed: false,
  order: 0,
  blockedReason: "",
  locked: false,
  tasks: [],
  workflow: [],
  selectedCategoryIds: [],
  availableCategories: [],
  progress: 0,
  name: "",
  clientName: "",
  createdByUid: "",
  createdByName: "",
  createdByEmail: "",
  status: "planning",
  address: "",
  city: "",
  landmark: "",
  googleMapsLink: "",
  clientPhone: "",
  startDate: "",
  custom: false,
  completedAt: null,
  amount: null,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFirestoreValue(value: unknown): boolean {
  if (value instanceof Date || value instanceof Timestamp) return true;
  if (value === null || typeof value !== "object") return false;
  return "_methodName" in value || "toDate" in value;
}

function isFieldValue(value: unknown): value is FieldValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "_methodName" in value
  );
}

function defaultForKey(key: string, existing: unknown): unknown {
  if (key in FIRESTORE_DEFAULTS) return FIRESTORE_DEFAULTS[key];
  if (typeof existing === "boolean") return false;
  if (typeof existing === "number") return 0;
  if (typeof existing === "string") return "";
  if (Array.isArray(existing)) return [];
  return null;
}

/**
 * Recursively replaces every `undefined` with a Firestore-safe value.
 * - Known optional fields use typed defaults (null, "", [], false)
 * - Unknown fields default to null
 * - Firestore Timestamp, Date, and FieldValue sentinels pass through unchanged
 */
export function sanitizeFirestorePayload<T>(data: T): T {
  return sanitizeValue(data, undefined) as T;
}

function sanitizeValue(value: unknown, parentKey?: string): unknown {
  if (value === undefined) {
    return parentKey ? defaultForKey(parentKey, value) : null;
  }

  if (value === null) return null;

  if (isFirestoreValue(value) || isFieldValue(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value instanceof Date) {
    return value;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) {
        result[key] = defaultForKey(key, val);
        continue;
      }
      result[key] = sanitizeValue(val, key);
    }
    return result;
  }

  return value;
}

/**
 * Strips keys whose sanitized value is null when you want a smaller document.
 * Not used by default — Firestore accepts null.
 */
export function omitNullFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== null) result[key] = val;
  }
  return result as Partial<T>;
}
