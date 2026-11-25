import type { Note } from "@/lib/db";

// The home page's notes: the logic alone, pure and tested next to it. lib/db.ts is the
// only module that writes to the database; the page wires these functions to the
// interface.

// What the form makes of the raw input: the text without its surrounding spaces, or
// null when nothing is left. A note is never empty, and never keeps its padding; what
// survives here is what the storage holds.
export function prepareNote(raw: string): Pick<Note, "text"> | null {
  const text = raw.trim();
  return text === "" ? null : { text };
}

// --- The notes file -----------------------------------------------------------------

// The notes' own copy, as the request describes it: one JSON object whose only key,
// "notes", holds the texts in display order, the most recent first. It is not the
// backup of the whole database, which lib/backup.ts and components/backup-buttons.tsx
// write.

export type NotesFileResult = { ok: true; notes: string[] } | { ok: false };

export function serializeNotes(texts: readonly string[]): string {
  return JSON.stringify({ notes: texts });
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// A file read whole before anything is written: the texts it holds, or the refusal. An
// unreadable file, a file that is not JSON, and a JSON whose "notes" is not a list of
// strings are all refused alike, and leave the stored notes alone. An empty list is a
// legal file: it says the list was empty.
export function readNotesFile(text: string): NotesFileResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  if (typeof file !== "object" || file === null || Array.isArray(file)) return { ok: false };
  const { notes } = file as Record<string, unknown>;
  return isStringList(notes) ? { ok: true, notes } : { ok: false };
}

// The storage keeps the notes by growing id, and the list shows the highest id first:
// writing the file's order back means adding its last note first, so that the first
// note of the file ends up with the highest id and comes first again.
export function inStorageOrder(texts: readonly string[]): string[] {
  return [...texts].reverse();
}
