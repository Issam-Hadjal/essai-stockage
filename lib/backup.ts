// The backup file of the database, as pure functions: lib/db.ts reads and writes the
// rows, this file decides what a backup file is worth. A backup is JSON: the project,
// the format of the file, the schema version the rows have, and the rows by table.

export const BACKUP_FORMAT = 1;

export type Backup = { version: number; tables: Record<string, Record<string, unknown>[]> };

export type BackupResult = { ok: true; backup: Backup } | { ok: false; error: string };

const NOT_A_BACKUP = "Ce fichier n’est pas une sauvegarde de cette application : rien n’a changé.";
const DAMAGED = "Cette sauvegarde est abîmée : rien n’a changé.";
const NEWER = "Cette sauvegarde vient d’une version plus récente de l’application : recharge la page, puis réessaie.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function makeBackup(project: string, version: number, tables: Record<string, unknown[]>, exportedAt: string): string {
  return JSON.stringify({ project, format: BACKUP_FORMAT, version, exportedAt, tables }, null, 2) + "\n";
}

// A backup file, checked whole before anything is written: the rows to put back and
// their version, or a message for the user. currentVersion is the number of versions
// in lib/db.ts: a backup cannot come from a later one.
export function readBackup(text: string, project: string, currentVersion: number): BackupResult {
  let backup: unknown;
  try {
    backup = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (!isRecord(backup) || backup.project !== project) return { ok: false, error: NOT_A_BACKUP };
  const { format, version, tables } = backup;
  if (typeof format === "number" && format > BACKUP_FORMAT) return { ok: false, error: NEWER };
  if (typeof version === "number" && Number.isInteger(version) && version > currentVersion) {
    return { ok: false, error: NEWER };
  }
  if (format !== BACKUP_FORMAT || typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: DAMAGED };
  }
  if (!isRecord(tables)) return { ok: false, error: DAMAGED };
  const rows: Backup["tables"] = {};
  for (const [name, list] of Object.entries(tables)) {
    if (!Array.isArray(list) || !list.every(isRecord)) return { ok: false, error: DAMAGED };
    rows[name] = list;
  }
  return { ok: true, backup: { version, tables: rows } };
}
