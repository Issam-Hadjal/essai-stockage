"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { makeBackup, readBackup } from "@/lib/backup";
import { type Database, db, exportTables, restoreTables } from "@/lib/db";

// The user's own copy of the data: IndexedDB lives in this browser only, and the
// browser may erase it. Export downloads one JSON file with every table; import puts
// such a file back, after a confirmation, in place of what this browser holds. The
// clock is read in the click handlers, never during a render.

const BUTTON =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 " +
  "disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

// The day in the browser's calendar, for the file name: never toISOString, which
// gives the UTC day.
function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked a little later: some browsers start the download after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// `database` is for the tests; the pages use the project's database.
export function BackupButtons({ database = db }: { database?: Database }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportData() {
    const now = new Date();
    setBusy(true);
    try {
      const rows = await exportTables(database);
      const text = makeBackup(database.name, database.schemaVersions.length, rows, now.toISOString());
      download(text, `${database.name}-sauvegarde-${localDay(now)}.json`);
      setMessage("Sauvegarde téléchargée.");
    } catch {
      setMessage("L’export a échoué : la base de ce navigateur ne répond pas.");
    } finally {
      setBusy(false);
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Emptied so that choosing the same file again fires a new change.
    event.target.value = "";
    if (!file) return;
    const result = readBackup(await file.text(), database.name, database.schemaVersions.length);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if (!window.confirm("Remplacer les données de ce navigateur par celles de la sauvegarde ?")) {
      setMessage("Import annulé : rien n’a changé.");
      return;
    }
    setBusy(true);
    try {
      await restoreTables(result.backup.tables, result.backup.version, database);
      setMessage("Sauvegarde importée.");
    } catch {
      setMessage("Cette sauvegarde ne correspond pas à cette application : rien n’a changé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={BUTTON} disabled={busy} onClick={exportData}>
        Exporter les données
      </button>
      <button type="button" className={BUTTON} disabled={busy} onClick={() => fileInput.current?.click()}>
        Importer une sauvegarde
      </button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importData} />
      <p role="status" className="w-full text-sm text-zinc-700 dark:text-zinc-300">
        {message}
      </p>
    </div>
  );
}
