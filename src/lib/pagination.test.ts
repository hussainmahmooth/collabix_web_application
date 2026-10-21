import { describe, expect, it } from "vitest";
import { readPages } from "./pagination";

describe("complete task history", () => {
  it("reads beyond the default API row limit", async () => {
    const records = Array.from({ length: 1203 }, (_, id) => ({ id }));
    const ranges: number[][] = [];
    const result = await readPages(async (from, to) => {
      ranges.push([from, to]);
      return { data: records.slice(from, to + 1), error: null };
    });
    expect(result).toEqual(records);
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });
  it("fails rather than presenting partial totals when a later page is denied", async () => {
    await expect(readPages(async (from) => from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => id), error: null }
      : { data: null, error: { message: "Permission denied" } },
    )).rejects.toThrow("Permission denied");
  });
});
