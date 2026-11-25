import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT, makeBackup, readBackup } from "./backup";

const exportedAt = "2026-11-25T10:00:00.000Z";
const tables = { notes: [{ id: 1, text: "lundi" }], tags: [] };

function file(fields: Record<string, unknown>): string {
  return JSON.stringify({ project: "essai", format: BACKUP_FORMAT, version: 2, exportedAt, tables, ...fields });
}

function error(text: string, currentVersion = 2): string {
  const result = readBackup(text, "essai", currentVersion);
  return result.ok ? "" : result.error;
}

describe("makeBackup and readBackup", () => {
  it("give back the rows and their version", () => {
    const text = makeBackup("essai", 2, tables, exportedAt);
    expect(JSON.parse(text)).toEqual({ project: "essai", format: BACKUP_FORMAT, version: 2, exportedAt, tables });
    expect(readBackup(text, "essai", 2)).toEqual({ ok: true, backup: { version: 2, tables } });
  });

  it("accept a backup of an older version", () => {
    expect(readBackup(file({ version: 1 }), "essai", 2)).toEqual({ ok: true, backup: { version: 1, tables } });
  });

  it("refuse a file that is not a backup of this project", () => {
    for (const text of ["{", "[]", "null", file({ project: "another-app" })]) {
      expect(error(text)).toMatch(/pas une sauvegarde de cette application/);
    }
  });

  it("refuse a backup of a newer format or of a later version", () => {
    expect(error(file({ format: BACKUP_FORMAT + 1 }))).toMatch(/plus récente/);
    expect(error(file({ version: 3 }))).toMatch(/plus récente/);
  });

  it("refuse a damaged backup whole", () => {
    for (const fields of [
      { format: undefined },
      { version: 0 },
      { version: 1.5 },
      { version: "2" },
      { tables: [] },
      { tables: { notes: {} } },
      { tables: { notes: [{ id: 1 }, "not a row"] } },
      { tables: { notes: [[1, 2]] } },
    ]) {
      expect(error(file(fields))).toMatch(/abîmée/);
    }
  });
});
