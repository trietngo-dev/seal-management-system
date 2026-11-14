export type PriorityLevel = "P0" | "P1" | "P2";

export interface ImprovementPriority {
  priority: PriorityLevel;
  text: string;
}

// The AI names the gap field differently from run to run; requirement_gap and
// actionable_step come from older prompt versions still stored in the database.
const GAP_KEYS = ["gap", "requirement_gap", "evidence_gap", "gap_reference", "related_gap", "linked_gap"];
const ACTION_KEYS = ["action", "actionable_step", "description", "title"];

function toLevel(value: unknown): PriorityLevel {
  const level = String(value || "").trim().toUpperCase();
  return level === "P0" || level === "P1" ? level : "P2";
}

function firstText(obj: Record<string, unknown>, keys: string[]): string {
  const key = keys.find((k) => typeof obj[k] === "string" && (obj[k] as string).trim());
  return key ? (obj[key] as string).trim() : "";
}

/**
 * Reads one improvement_priorities item, which is either a "P0: ..." string or an
 * object with a priority, an action and a gap under one of several key names.
 */
export function parseImprovementPriority(item: unknown): ImprovementPriority {
  if (typeof item === "string") {
    const match = item.match(/^\s*(P[012])\s*[:\-–]?\s*/i);
    return {
      priority: toLevel(match?.[1]),
      text: match ? item.slice(match[0].length) : item,
    };
  }
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const action = firstText(obj, ACTION_KEYS);
    const gap = firstText(obj, GAP_KEYS);
    return { priority: toLevel(obj.priority), text: gap ? `[${gap}] ${action}` : action };
  }
  return { priority: "P2", text: "" };
}
