"use client";

import { type Database, db, type Note } from "@/lib/db";
import { download, localDay } from "@/lib/download";
import { serializeNotesCsv } from "@/lib/notes";

// The notes for a spreadsheet: « Exporter en CSV » downloads one CSV file, a first line
// naming the columns, then a line per note, a column per datum the application keeps. It
// reads the notes the page already shows; the clock is read in the click handler, never
// during a render.

const BUTTON =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 " +
  "disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

// `notes` is the list as the page shows it: the file holds exactly that order.
// `database` is for the tests; the page uses the project's database.
export function NotesExport({ notes, database = db }: { notes: readonly Note[]; database?: Database }) {
  function exportCsv() {
    const now = new Date();
    const fileName = `${database.name}-notes-${localDay(now)}.csv`;
    download(serializeNotesCsv(notes), fileName, "text/csv;charset=utf-8");
  }

  return (
    <button type="button" className={BUTTON} onClick={exportCsv}>
      Exporter en CSV
    </button>
  );
}
