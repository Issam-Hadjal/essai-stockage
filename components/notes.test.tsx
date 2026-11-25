import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Database, exportTables } from "@/lib/db";
import { Notes } from "./notes";

// vitest.config.mts gives every test file an in-memory IndexedDB (fake-indexeddb).
let database: Database;

beforeEach(() => {
  database = new Database("test-notes", [{ stores: { notes: "++id" } }]);
});

afterEach(async () => {
  await database.delete();
});

function addNote(text: string) {
  fireEvent.change(screen.getByLabelText("Note"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
}

// The text of every row, in the order the page shows them.
function rows(): (string | null | undefined)[] {
  return screen.queryAllByRole("listitem").map((row) => row.querySelector("span")?.textContent);
}

describe("Notes", () => {
  it("adds a note, then shows the most recent one first", async () => {
    render(<Notes database={database} />);
    addNote("Acheter du pain");
    await waitFor(() => expect(rows()).toEqual(["Acheter du pain"]));
    addNote("Appeler");
    await waitFor(() => expect(rows()).toEqual(["Appeler", "Acheter du pain"]));
  });

  it("stores the text without its surrounding spaces, and drops an empty note", async () => {
    render(<Notes database={database} />);
    addNote("");
    addNote("   ");
    expect(rows()).toEqual([]);
    expect(await exportTables(database)).toEqual({ notes: [] });
    addNote("  texte  ");
    await waitFor(() => expect(rows()).toEqual(["texte"]));
    expect(await exportTables(database)).toEqual({ notes: [{ id: 1, text: "texte" }] });
  });

  it("removes a note from the list and from the storage", async () => {
    render(<Notes database={database} />);
    addNote("première");
    addNote("deuxième");
    await waitFor(() => expect(rows()).toEqual(["deuxième", "première"]));
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" })[0]);
    await waitFor(() => expect(rows()).toEqual(["première"]));
    expect(await exportTables(database)).toEqual({ notes: [{ id: 1, text: "première" }] });
  });
});
