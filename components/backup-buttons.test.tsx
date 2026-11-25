import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_FORMAT } from "@/lib/backup";
import { Database, exportTables } from "@/lib/db";
import { BackupButtons } from "./backup-buttons";

// vitest.config.mts gives every test file an in-memory IndexedDB (fake-indexeddb).
let database: Database;

function backupFile(content: unknown): File {
  return new File([JSON.stringify(content)], "sauvegarde.json", { type: "application/json" });
}

function chooseFile(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  database = new Database("essai", [{ stores: { notes: "++id" } }]);
  await database.table("notes").add({ text: "déjà là" });
});

afterEach(async () => {
  await database.delete();
});

describe("BackupButtons", () => {
  it("downloads every table in one file", async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
      blob = b as Blob;
      return "blob:backup";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let fileName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      fileName = this.download;
    });
    render(<BackupButtons database={database} />);
    fireEvent.click(screen.getByRole("button", { name: "Exporter les données" }));
    expect(await screen.findByText("Sauvegarde téléchargée.")).toBeTruthy();
    expect(fileName).toMatch(/^essai-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(await blob!.text());
    expect(backup).toMatchObject({ project: "essai", format: BACKUP_FORMAT, version: 1 });
    expect(backup.tables).toEqual({ notes: [{ id: 1, text: "déjà là" }] });
  });

  it("puts a backup back after a confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<BackupButtons database={database} />);
    chooseFile(
      container,
      backupFile({ project: "essai", format: BACKUP_FORMAT, version: 1, tables: { notes: [{ id: 7, text: "importée" }] } }),
    );
    expect(await screen.findByText("Sauvegarde importée.")).toBeTruthy();
    expect(await exportTables(database)).toEqual({ notes: [{ id: 7, text: "importée" }] });
  });

  it("changes nothing when the user cancels", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { container } = render(<BackupButtons database={database} />);
    chooseFile(container, backupFile({ project: "essai", format: BACKUP_FORMAT, version: 1, tables: { notes: [] } }));
    expect(await screen.findByText("Import annulé : rien n’a changé.")).toBeTruthy();
    expect(await exportTables(database)).toEqual({ notes: [{ id: 1, text: "déjà là" }] });
  });

  it("refuses a file that is not a backup of this project, without asking", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const { container } = render(<BackupButtons database={database} />);
    chooseFile(container, backupFile({ project: "another-app", format: BACKUP_FORMAT, version: 1, tables: {} }));
    expect(await screen.findByText(/pas une sauvegarde de cette application/)).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("changes nothing when the backup's tables do not fit", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<BackupButtons database={database} />);
    chooseFile(container, backupFile({ project: "essai", format: BACKUP_FORMAT, version: 1, tables: { tasks: [] } }));
    expect(await screen.findByText(/ne correspond pas à cette application/)).toBeTruthy();
    expect(await exportTables(database)).toEqual({ notes: [{ id: 1, text: "déjà là" }] });
  });
});
