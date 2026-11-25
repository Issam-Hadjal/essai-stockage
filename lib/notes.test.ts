import { describe, expect, it } from "vitest";
import { prepareNote } from "./notes";

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
