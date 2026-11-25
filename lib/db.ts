import Dexie, { type Transaction } from "dexie";

// The project's database: IndexedDB, in this browser only, through Dexie. This is the
// only module that imports dexie: the schema, the type of each table's rows, the
// Database class. Components read it with useLiveQuery and write to it in event
// handlers; lib/<feature>/ imports nothing from it but types, and only shapes rows.

export const DB_NAME = "essai-stockage";

export type SchemaVersion = {
  // The tables that change in this version: "++id, due" is the primary key, then the
  // indexed fields only; null deletes the table.
  stores: Record<string, string | null>;
  // Rewrites the rows people already have when their shape changes, through the
  // transaction it receives, never through `db`.
  upgrade?: (transaction: Transaction) => PromiseLike<unknown> | void;
};

// The schema, one entry per version, oldest first. A change adds the next entry; an
// entry already on main is never edited or removed: browsers hold data in its shape.
export const VERSIONS: readonly SchemaVersion[] = [
  // 1: the empty database the project opened with.
  { stores: {} },
];

// The type of each table's rows, here, next to the schema. For example:
//   export type Note = { id: number; text: string };

export class Database extends Dexie {
  // One typed line per table, as `declare`: it only types the table that Dexie sets,
  // and emits nothing. For example, with EntityTable imported from dexie:
  //   declare notes: EntityTable<Note, "id">;
  readonly schemaVersions: readonly SchemaVersion[];

  constructor(name: string = DB_NAME, versions: readonly SchemaVersion[] = VERSIONS) {
    super(name);
    this.schemaVersions = versions;
    versions.forEach((version, index) => {
      const declared = this.version(index + 1).stores(version.stores);
      if (version.upgrade) declared.upgrade(version.upgrade);
    });
  }
}

export const db = new Database();

// --- The backup ---------------------------------------------------------------------

export type Rows = Record<string, unknown[]>;

// Every row of every table, read in one transaction: what the backup exports.
export async function exportTables(database: Database = db): Promise<Rows> {
  if (database.tables.length === 0) return {};
  return database.transaction("r", database.tables, async () => {
    const rows: Rows = {};
    for (const table of database.tables) rows[table.name] = await table.toArray();
    return rows;
  });
}

function tableNames(database: Dexie): Set<string> {
  return new Set(database.tables.map((table) => table.name));
}

// A backup of an older version goes through the upgrades in a scratch database, as if
// the rows had stayed in the browser all along.
async function upgradeRows(rows: Rows, fromVersion: number, database: Database): Promise<Rows> {
  const scratch = `${database.name}-restore`;
  await Dexie.delete(scratch);
  const older = new Database(scratch, database.schemaVersions.slice(0, fromVersion));
  try {
    for (const name of Object.keys(rows)) {
      if (!tableNames(older).has(name)) throw new Error(`The backup has a table "${name}" that version ${fromVersion} lacks.`);
    }
    if (older.tables.length > 0) {
      await older.transaction("rw", older.tables, async () => {
        for (const table of older.tables) await table.bulkAdd(rows[table.name] ?? []);
      });
    }
  } finally {
    older.close();
  }
  const upgraded = new Database(scratch, database.schemaVersions);
  try {
    return await exportTables(upgraded);
  } finally {
    upgraded.close();
    await Dexie.delete(scratch);
  }
}

// Puts a backup in place of everything the database holds, in one transaction: the
// whole backup, or nothing. Throws, changing nothing, when the backup does not fit.
export async function restoreTables(rows: Rows, fromVersion: number, database: Database = db): Promise<void> {
  const current = database.schemaVersions.length;
  if (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion > current) {
    throw new Error(`The backup's version ${fromVersion} is not between 1 and ${current}.`);
  }
  const upgraded = fromVersion < current ? await upgradeRows(rows, fromVersion, database) : rows;
  for (const name of Object.keys(upgraded)) {
    if (!tableNames(database).has(name)) throw new Error(`The backup has a table "${name}" that the database lacks.`);
  }
  if (database.tables.length === 0) return;
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) {
      await table.clear();
      await table.bulkAdd(upgraded[table.name] ?? []);
    }
  });
}
