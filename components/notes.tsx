"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { type Database, db } from "@/lib/db";
import { prepareNote } from "@/lib/notes";
import { NotesBackup } from "./notes-backup";
import { NotesExport } from "./notes-export";

// The home page's notes: the form, then the list, the most recent note first, with a
// delete button on each row. The rows come from useLiveQuery, which renders again at
// every change of the notes; the writes happen in the event handlers, never during a
// render. While loading, and in the prerender, there is no row yet.

const FIELD =
  "w-64 max-w-full rounded-md border border-zinc-300 px-3 py-2 text-sm " +
  "dark:border-zinc-700 dark:bg-zinc-900";
const BUTTON =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 " +
  "disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

// `database` is for the tests; the page uses the project's database.
export function Notes({ database = db }: { database?: Database }) {
  const [draft, setDraft] = useState("");
  const notes = useLiveQuery(() => database.notes.orderBy(":id").reverse().toArray(), [database]);

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = prepareNote(draft);
    // An empty note, or one made of spaces, leaves both the list and the storage alone.
    if (!note) return;
    await database.notes.add(note);
    setDraft("");
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">Notes</h2>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={addNote}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="note">
            Note
          </label>
          <input
            id="note"
            name="note"
            type="text"
            className={FIELD}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <button type="submit" className={BUTTON}>
          Ajouter
        </button>
      </form>
      <ul className="mt-6 flex flex-col gap-2">
        {(notes ?? []).map((note) => (
          <li
            key={note.id}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <span className="break-words">{note.text}</span>
            <button type="button" className={BUTTON} onClick={() => void database.notes.delete(note.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
      {/* The exports sit on one line under the list: the CSV for a spreadsheet, then the
          JSON copy the import takes back. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <NotesExport notes={notes ?? []} database={database} />
        <NotesBackup texts={(notes ?? []).map((note) => note.text)} database={database} />
      </div>
    </section>
  );
}
