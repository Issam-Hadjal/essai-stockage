import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/db";
import { inStorageOrder, prepareNote, readNotesFile, serializeNotes, serializeNotesCsv } from "./notes";

describe("prepareNote", () => {
  it("keeps a valid note as it was typed", () => {
    expect(prepareNote("Acheter du pain")).toEqual({ text: "Acheter du pain" });
  });

  it("drops the spaces around a note, and keeps the ones inside", () => {
    expect(prepareNote("  Acheter du pain  ")).toEqual({ text: "Acheter du pain" });
    expect(prepareNote("deux  mots ")).toEqual({ text: "deux  mots" });
    expect(prepareNote("\n\tAcheter du pain\n")).toEqual({ text: "Acheter du pain" });
  });

  it("refuses an empty note, or one made of spaces only", () => {
    expect(prepareNote("")).toBeNull();
    expect(prepareNote("   ")).toBeNull();
    expect(prepareNote("\n\t ")).toBeNull();
    // The spaces a French keyboard inserts: ordinary trim covers them too.
    expect(prepareNote("\u00a0\u202f")).toBeNull();
  });
});

describe("serializeNotes", () => {
  it("writes one JSON object, whose only key is the notes in display order", () => {
    const text = serializeNotes(["Appeler", "Acheter du pain"]);
    expect(JSON.parse(text)).toEqual({ notes: ["Appeler", "Acheter du pain"] });
    expect(Object.keys(JSON.parse(text))).toEqual(["notes"]);
  });

  it("writes an empty list for an empty list", () => {
    expect(JSON.parse(serializeNotes([]))).toEqual({ notes: [] });
  });
});

describe("readNotesFile", () => {
  it("reads a file the export wrote", () => {
    const text = serializeNotes(["Appeler", "Acheter du pain"]);
    expect(readNotesFile(text)).toEqual({ ok: true, notes: ["Appeler", "Acheter du pain"] });
  });

  it("reads a hand-written file, with its spaces and line breaks", () => {
    expect(readNotesFile('{\n  "notes": ["Appeler"]\n}\n')).toEqual({ ok: true, notes: ["Appeler"] });
  });

  it("reads an empty list as one", () => {
    expect(readNotesFile('{"notes": []}')).toEqual({ ok: true, notes: [] });
  });

  it("refuses an empty file", () => {
    expect(readNotesFile("")).toEqual({ ok: false });
    expect(readNotesFile("   \n")).toEqual({ ok: false });
  });

  it("refuses a file that is not JSON", () => {
    expect(readNotesFile("notes : Appeler")).toEqual({ ok: false });
    expect(readNotesFile("<html></html>")).toEqual({ ok: false });
  });

  it("refuses a JSON whose notes is not a list of strings", () => {
    expect(readNotesFile("{}")).toEqual({ ok: false });
    expect(readNotesFile('{"notes": null}')).toEqual({ ok: false });
    expect(readNotesFile('{"notes": "Appeler"}')).toEqual({ ok: false });
    expect(readNotesFile('{"notes": {"0": "Appeler"}}')).toEqual({ ok: false });
    expect(readNotesFile('{"notes": ["Appeler", 12]}')).toEqual({ ok: false });
    expect(readNotesFile('{"notes": [null]}')).toEqual({ ok: false });
    expect(readNotesFile('{"notes": [["Appeler"]]}')).toEqual({ ok: false });
  });

  it("refuses a JSON that is not an object", () => {
    expect(readNotesFile("null")).toEqual({ ok: false });
    expect(readNotesFile("[]")).toEqual({ ok: false });
    expect(readNotesFile('["Appeler"]')).toEqual({ ok: false });
    expect(readNotesFile("12")).toEqual({ ok: false });
    expect(readNotesFile('"Appeler"')).toEqual({ ok: false });
  });
});

describe("inStorageOrder", () => {
  it("gives the notes back from the last of the file to the first", () => {
    expect(inStorageOrder(["Appeler", "Acheter du pain"])).toEqual(["Acheter du pain", "Appeler"]);
  });

  it("leaves the list it reads alone", () => {
    const texts = ["Appeler", "Acheter du pain"];
    inStorageOrder(texts);
    expect(texts).toEqual(["Appeler", "Acheter du pain"]);
  });

  it("has nothing to reverse in an empty list", () => {
    expect(inStorageOrder([])).toEqual([]);
  });
});

// A reader for the format serializeNotesCsv writes: quoted fields, doubled quotes, and
// the separator or a line break inside the quotes. It reads a produced text back, so that
// a test tells an escaped value from a broken one, where an expected string could not.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character !== '"') field += character;
      else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" && text[index + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else field += character;
  }
  // The export ends with a line break: nothing is left to read.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const NOTES: Note[] = [
  { id: 2, text: "Appeler" },
  { id: 1, text: "Acheter du pain" },
];

describe("serializeNotesCsv", () => {
  it("names the columns on the first line, then writes one line per note, a column per datum", () => {
    expect(parseCsv(serializeNotesCsv(NOTES))).toEqual([
      ["id", "texte"],
      ["2", "Appeler"],
      ["1", "Acheter du pain"],
    ]);
  });

  it("writes the first line alone when there is no note", () => {
    expect(parseCsv(serializeNotesCsv([]))).toEqual([["id", "texte"]]);
  });

  it("quotes a value holding the separator, a double quote or a line break, and reads it back whole", () => {
    const values = ["un, deux", 'il a dit "bonjour"', "première ligne\nseconde ligne"];
    const notes = values.map((text, index) => ({ id: index + 1, text }));

    const rows = parseCsv(serializeNotesCsv(notes));

    expect(rows.slice(1).map((row) => row[1])).toEqual(values);
  });

  it("doubles the double quotes of a value, as RFC 4180 asks", () => {
    expect(serializeNotesCsv([{ id: 1, text: 'il a dit "bonjour"' }])).toBe(
      'id,texte\r\n1,"il a dit ""bonjour"""\r\n',
    );
  });

  it("keeps the accented characters", () => {
    const text = "Déjà vu à Noël, très bien";
    expect(parseCsv(serializeNotesCsv([{ id: 1, text }]))[1][1]).toBe(text);
  });

  it("leaves the list it reads alone", () => {
    const notes = [{ id: 1, text: "Appeler" }];

    serializeNotesCsv(notes);

    expect(notes).toEqual([{ id: 1, text: "Appeler" }]);
  });
});
