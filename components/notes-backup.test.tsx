import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Database } from "@/lib/db";
import { NotesBackup } from "./notes-backup";

// vitest.config.mts gives every test file an in-memory IndexedDB (fake-indexeddb).
let database: Database;

const REFUSED = "Ce fichier n’est pas une sauvegarde des notes : rien n’a changé.";

beforeEach(async () => {
  vi.restoreAllMocks();
  database = new Database("test-notes-backup", [{ stores: { notes: "++id" } }]);
  await database.notes.add({ text: "déjà là" });
});

afterEach(async () => {
  await database.delete();
});

function notesFile(content: string): File {
  return new File([content], "notes.json", { type: "application/json" });
}

function chooseFile(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  fireEvent.change(input, { target: { files: [file] } });
}

// The stored notes, in the order the list shows them.
async function storedTexts(): Promise<string[]> {
  const notes = await database.notes.orderBy(":id").reverse().toArray();
  return notes.map((note) => note.text);
}

// One file, one fresh render: the message has to come from this import.
async function importFile(content: string) {
  const { container, unmount } = render(<NotesBackup texts={[]} database={database} />);
  chooseFile(container, notesFile(content));
  expect(await screen.findByText(REFUSED)).toBeTruthy();
  expect(await storedTexts()).toEqual(["déjà là"]);
  unmount();
}

describe("NotesBackup", () => {
  it("downloads the notes in display order, and nothing else in the file", async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
      blob = object as Blob;
      return "blob:notes";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let fileName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      fileName = this.download;
    });
    render(<NotesBackup texts={["Appeler", "Acheter du pain"]} database={database} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter les données" }));

    expect(await screen.findByText("Notes exportées.")).toBeTruthy();
    expect(fileName).toMatch(/^test-notes-backup-notes-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await blob!.text())).toEqual({ notes: ["Appeler", "Acheter du pain"] });
  });

  it("downloads an empty list when the list is empty", async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
      blob = object as Blob;
      return "blob:notes";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<NotesBackup texts={[]} database={database} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter les données" }));

    expect(await screen.findByText("Notes exportées.")).toBeTruthy();
    expect(JSON.parse(await blob!.text())).toEqual({ notes: [] });
  });

  it("puts the file's notes in place of the stored ones, in its order", async () => {
    const { container } = render(<NotesBackup texts={[]} database={database} />);

    chooseFile(container, notesFile('{"notes": ["Appeler", "Acheter du pain"]}'));

    expect(await screen.findByText("Notes importées.")).toBeTruthy();
    // "déjà là" is gone: the import replaces, it does not merge.
    expect(await storedTexts()).toEqual(["Appeler", "Acheter du pain"]);
  });

  it("clears the notes when the file holds an empty list", async () => {
    const { container } = render(<NotesBackup texts={[]} database={database} />);

    chooseFile(container, notesFile('{"notes": []}'));

    expect(await screen.findByText("Notes importées.")).toBeTruthy();
    expect(await storedTexts()).toEqual([]);
  });

  it("refuses an empty file", async () => {
    await importFile("");
  });

  it("refuses a file that is not JSON", async () => {
    await importFile("notes : Appeler");
    await importFile("<html></html>");
  });

  it("refuses a JSON whose notes is not a list of strings", async () => {
    for (const content of ["{}", '{"notes": null}', '{"notes": "Appeler"}', '{"notes": [12]}', '{"notes": [null]}']) {
      await importFile(content);
    }
  });

  it("refuses a JSON that is not an object", async () => {
    for (const content of ["null", "[]", '["Appeler"]', "12"]) {
      await importFile(content);
    }
  });
});
