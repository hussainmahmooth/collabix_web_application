import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Footer, Modal } from "./ui";
afterEach(cleanup);
describe("shared interface", () => {
  it("always includes the permanent developer credit without a fabricated URL", () => {
    render(<Footer />);
    expect(screen.getByText("Micro Biz Tek").tagName).toBe("STRONG");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("opens an accessible, labelled dialog", () => {
    render(
      <Modal title="Create task" onClose={() => {}}>
        <p>Task details</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Create task" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeTruthy();
  });
});
