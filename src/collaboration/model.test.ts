import { describe, expect, it } from "vitest";
import { safeLink, toInstant, validateFile, zonedInput } from "./model";
describe("collaboration input boundaries", () => {
  it("converts IANA meeting times to stable UTC instants", () => {
    expect(toInstant("2027-01-02T10:30", "Asia/Colombo")).toBe(
      "2027-01-02T05:00:00.000Z",
    );
    expect(zonedInput("2027-01-02T05:00:00.000Z", "Asia/Colombo")).toBe(
      "2027-01-02T10:30",
    );
    expect(toInstant("2027-07-01T09:00", "America/New_York")).toBe(
      "2027-07-01T13:00:00.000Z",
    );
  });
  it("rejects nonexistent daylight-saving times and invalid zones", () => {
    expect(() => toInstant("2027-03-14T02:30", "America/New_York")).toThrow(
      "does not exist",
    );
    expect(() => toInstant("2027-01-02T10:30", "invalid/zone")).toThrow();
  });
  it("accepts supported files and normalizes browser CSV MIME variants", () => {
    expect(
      validateFile({
        name: "analysis.CSV",
        size: 50,
        type: "application/vnd.ms-excel",
      }),
    ).toEqual({ ext: "csv", mime: "text/csv" });
    expect(
      validateFile({ name: "paper.pdf", size: 1024, type: "application/pdf" })
        .ext,
    ).toBe("pdf");
  });
  it("blocks oversized, empty, executable, SVG and mismatched uploads", () => {
    for (const f of [
      { name: "large.pdf", size: 20971521, type: "application/pdf" },
      { name: "empty.txt", size: 0, type: "text/plain" },
      { name: "run.exe", size: 50, type: "" },
      { name: "image.svg", size: 50, type: "image/svg+xml" },
      { name: "fake.pdf", size: 50, type: "text/html" },
    ])
      expect(() => validateFile(f)).toThrow();
  });
  it("only makes HTTP meeting locations clickable", () => {
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("Room 201")).toBeNull();
    expect(safeLink("https://meet.example.com/team")).toBe(
      "https://meet.example.com/team",
    );
  });
});
