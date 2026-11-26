"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { type Database, db } from "@/lib/db";
import { download, localDay } from "@/lib/download";
import { inStorageOrder, readNotesFile, serializeNotes } from "@/lib/notes";

// The notes' own copy, under the list: they live in this browser only, so « Exporter
// les données » downloads them as one JSON file, and « Importer une sauvegarde » puts
// such a file back in place of the stored notes, in their order. The clock is read in
// the click handler, never during a render.

const BUTTON =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 " +
  "disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

// `texts` is the list as the page shows it: the file holds exactly that order.
// `database` is for the tests; the page uses the project's database.
export function NotesBackup({ texts, database = db }: { texts: readonly string[]; database?: Database }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  function exportNotes() {
    const now = new Date();
    download(serializeNotes(texts), `${database.name}-notes-${localDay(now)}.json`);
    setMessage("Notes exportées.");
  }

  async function importNotes(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Emptied so that choosing the same file again fires a new change.
    event.target.value = "";
    if (!file) return;
    const result = readNotesFile(await file.text());
    // A file refused changes nothing: what the browser holds stays as it was.
    if (!result.ok) {
      setMessage("Ce fichier n’est pas une sauvegarde des notes : rien n’a changé.");
      return;
    }
    try {
      // One transaction for the whole file: every note of it, or none.
      await database.transaction("rw", database.notes, async () => {
        await database.notes.clear();
        for (const text of inStorageOrder(result.notes)) await database.notes.add({ text });
      });
      setMessage("Notes importées.");
    } catch {
      setMessage("L’import a échoué : le stockage de ce navigateur ne répond pas.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={BUTTON} onClick={exportNotes}>
        Exporter les données
      </button>
      <button type="button" className={BUTTON} onClick={() => fileInput.current?.click()}>
        Importer une sauvegarde
      </button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importNotes} />
      <p role="status" className="w-full text-sm text-zinc-700 dark:text-zinc-300">
        {message}
      </p>
    </div>
  );
}
