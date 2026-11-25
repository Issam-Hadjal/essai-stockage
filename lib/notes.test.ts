import { describe, expect, it } from "vitest";
import { inStorageOrder, prepareNote, readNotesFile, serializeNotes } from "./notes";

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
