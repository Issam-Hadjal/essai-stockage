import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Database } from "@/lib/db";
import { NotesExport } from "./notes-export";

// vitest.config.mts gives every test file an in-memory IndexedDB (fake-indexeddb).
let database: Database;

beforeEach(() => {
  vi.restoreAllMocks();
  database = new Database("test-notes-export", [{ stores: { notes: "++id" } }]);
});

afterEach(async () => {
  await database.delete();
});

// What the click hands the browser: the blob read, and the name of the file downloaded.
function captureDownload() {
  const download = { blob: undefined as Blob | undefined, fileName: "" };
  vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
    download.blob = object as Blob;
    return "blob:notes";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    download.fileName = this.download;
  });
  return download;
}

describe("NotesExport", () => {
  it("offers a button labelled exactly « Exporter en CSV »", () => {
    render(<NotesExport notes={[]} database={database} />);
    expect(screen.getByRole("button", { name: "Exporter en CSV" })).toBeTruthy();
  });

  it("downloads the notes under a .csv name, a line per note, a column per datum", async () => {
    const download = captureDownload();
    render(
      <NotesExport
        notes={[
          { id: 2, text: "Appeler" },
          { id: 1, text: "Acheter du pain" },
        ]}
        database={database}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Exporter en CSV" }));

    expect(download.fileName).toMatch(/^test-notes-export-notes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await download.blob!.text()).toBe("id,texte\r\n2,Appeler\r\n1,Acheter du pain\r\n");
    expect(download.blob!.type).toBe("text/csv;charset=utf-8");
  });

  it("downloads the first line alone when there is no note", async () => {
    const download = captureDownload();
    render(<NotesExport notes={[]} database={database} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter en CSV" }));

    expect(await download.blob!.text()).toBe("id,texte\r\n");
  });
});
