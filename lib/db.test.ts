import { afterEach, describe, expect, it } from "vitest";
import { Database, db, exportTables, restoreTables, VERSIONS, type SchemaVersion } from "./db";

// vitest.config.mts gives every test file an in-memory IndexedDB (fake-indexeddb).

describe("the project's database", () => {
  it("opens with every version of the schema", async () => {
    await db.open();
    expect(db.verno).toBe(VERSIONS.length);
    db.close();
  });

  it("gives every table an inbound primary key, which the backup keeps", () => {
    const outbound = db.tables.filter((table) => !table.schema.primKey.keyPath).map((table) => table.name);
    expect(outbound, `tables without an inbound key (id, ++id, &code...): ${outbound.join(", ")}`).toEqual([]);
  });
});

// A database of its own for each test, with notes: version 1 stores the text only,
// version 2 adds an indexed title, filled for the rows people already have.
const V1: SchemaVersion = { stores: { notes: "++id" } };
const V2: SchemaVersion = {
  stores: { notes: "++id, title" },
  upgrade: (transaction) =>
    transaction
      .table("notes")
      .toCollection()
      .modify((note: { text: string; title?: string }) => {
        note.title = note.text.slice(0, 5);
      }),
};
let opened: Database[] = [];
let count = 0;

function testDatabase(versions: SchemaVersion[]): Database {
  count += 1;
  const database = new Database(`test-${count}`, versions);
  opened.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(opened.map((database) => database.delete()));
  opened = [];
});

describe("exportTables and restoreTables", () => {
  it("export every row, and an empty database as no table", async () => {
    const database = testDatabase([V1]);
    await database.table("notes").bulkAdd([{ text: "lundi" }, { text: "mardi" }]);
    expect(await exportTables(database)).toEqual({
      notes: [
        { id: 1, text: "lundi" },
        { id: 2, text: "mardi" },
      ],
    });
    expect(await exportTables(testDatabase([{ stores: {} }]))).toEqual({});
  });

  it("put a backup in place of everything the database holds", async () => {
    const database = testDatabase([V1]);
    await database.table("notes").bulkAdd([{ text: "à remplacer" }, { text: "à retirer" }]);
    await restoreTables({ notes: [{ id: 1, text: "gardée" }] }, 1, database);
    expect(await exportTables(database)).toEqual({ notes: [{ id: 1, text: "gardée" }] });
  });

  it("bring a backup of an older version through the upgrades", async () => {
    const database = testDatabase([V1, V2]);
    await restoreTables({ notes: [{ id: 4, text: "réunion lundi" }] }, 1, database);
    expect(await exportTables(database)).toEqual({ notes: [{ id: 4, text: "réunion lundi", title: "réuni" }] });
    expect(await database.table("notes").where("title").equals("réuni").count()).toBe(1);
  });

  it("change nothing when the backup does not fit", async () => {
    const database = testDatabase([V1, V2]);
    await database.table("notes").add({ text: "intacte", title: "intac" });
    const before = await exportTables(database);
    await expect(restoreTables({ tasks: [{ id: 1 }] }, 2, database)).rejects.toThrow(/tasks/);
    await expect(restoreTables({ tasks: [{ id: 1 }] }, 1, database)).rejects.toThrow(/tasks/);
    await expect(restoreTables({ notes: [{ id: 1, text: "x" }] }, 3, database)).rejects.toThrow(/version/);
    await expect(restoreTables({ notes: [{ id: 1, text: "x" }, "not a row"] }, 2, database)).rejects.toThrow();
    expect(await exportTables(database)).toEqual(before);
  });

  it("change nothing when an upgrade fails", async () => {
    const failing: SchemaVersion = {
      stores: {},
      upgrade: () => {
        throw new Error("upgrade bug");
      },
    };
    const database = testDatabase([V1, failing]);
    await database.table("notes").add({ text: "intacte" });
    await expect(restoreTables({ notes: [{ id: 9, text: "x" }] }, 1, database)).rejects.toThrow();
    expect(await exportTables(database)).toEqual({ notes: [{ id: 1, text: "intacte" }] });
  });
});
