import { describe, expect, it } from "vitest";
import { accepts, fileProblem, roomFor } from "./upload";

const f = (name: string, type: string, size = 10) => ({ name, type, size });

describe("upload rules", () => {
  it("accept takes MIME types, families and extensions, case-insensitive; no list accepts all", () => {
    expect(accepts(f("a.PNG", "image/png"), ["image/png"])).toBe(true);
    expect(accepts(f("a.jpg", "image/jpeg"), ["image/*"])).toBe(true);
    expect(accepts(f("Report.PDF", ""), [".pdf"])).toBe(true);
    expect(accepts(f("a.exe", "application/x-msdownload"), ["image/*", ".pdf"])).toBe(false);
    expect(accepts(f("a.exe", ""), undefined)).toBe(true);
  });
  it("problems: type first, then size, then empty, worded as GOV.UK file upload errors", () => {
    expect(fileProblem(f("a.exe", "x"), { accept: [".pdf"] }, "a PDF")).toBe("The file must be a PDF.");
    expect(fileProblem(f("a.exe", "x"), { accept: [".pdf", ".png"] })).toBe("The file must be one of .pdf, .png.");
    expect(fileProblem(f("a.pdf", "application/pdf", 6 * 1024 * 1024), { accept: [".pdf"], maxSize: 5 * 1024 * 1024 })).toBe("The file must be smaller than 5 MB.");
    expect(fileProblem(f("a.pdf", "application/pdf", 0), {})).toBe("The file is empty.");
    expect(fileProblem(f("a.pdf", "application/pdf"), { accept: [".pdf"], maxSize: 100 })).toBeNull();
  });
  it("roomFor keeps the count under the max", () => {
    expect(roomFor(3, 4, 5)).toBe(2);
    expect(roomFor(5, 1, 5)).toBe(0);
    expect(roomFor(9, 4)).toBe(4);
  });
});
