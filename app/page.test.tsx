import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("shows the project title as the page heading", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Essai stockage");
  });

  it("keeps its text, then offers the form and the list of notes", () => {
    render(<Home />);
    expect(screen.getByText(/Projet jetable pour essayer ouvrir-projet/)).toBeTruthy();
    expect(screen.getByLabelText("Note")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeTruthy();
    expect(screen.getByRole("list")).toBeTruthy();
  });
});
