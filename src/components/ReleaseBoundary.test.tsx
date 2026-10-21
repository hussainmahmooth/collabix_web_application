import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ReleaseBoundary from "./ReleaseBoundary";

it("provides branded recovery when a lazy route or render fails", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  function Broken(): never { throw new Error("Chunk unavailable"); }
  try {
    render(<ReleaseBoundary><Broken /></ReleaseBoundary>);
    expect(screen.getByRole("button", { name: "Reload ResearchFlow" })).toBeTruthy();
    expect(screen.getByText("Micro Biz Tek")).toBeTruthy();
    expect(screen.queryByText("Chunk unavailable")).toBeNull();
  } finally { log.mockRestore(); }
});
