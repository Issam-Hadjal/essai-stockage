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
