import { describe, expect, it } from "vitest";
import { adoptSearch, parseQuery, searchToSend, serializeQuery } from "./query";

const KEYS = ["status", "pemilik", "tim"] as const;

describe("parseQuery", () => {
  it("memisahkan filter kunci:nilai dari teks bebas", () => {
    expect(parseQuery("status:menurun pemilik:rina gpu", KEYS)).toEqual({ text: "gpu", filters: { status: ["menurun"], pemilik: ["rina"] } });
  });
  it("nilai berkutip dan banyak nilai untuk satu kunci", () => {
    expect(parseQuery('tim:"IT Core" status:sehat status:down', KEYS)).toEqual({ text: "", filters: { tim: ["IT Core"], status: ["sehat", "down"] } });
  });
  it("kunci tak dikenal dan kutip tak tertutup menjadi teks biasa", () => {
    expect(parseQuery('rahasia:x "tanpa tutup', KEYS)).toEqual({ text: 'rahasia:x "tanpa tutup', filters: {} });
  });
  it("kunci tidak peka huruf, nilai kosong diabaikan", () => {
    expect(parseQuery("STATUS:Down status:", KEYS)).toEqual({ text: "", filters: { status: ["down"] } });
  });
  it("a known key with an empty value is no filter and no free text", () => {
    expect(parseQuery('status: tim:"" gpu', KEYS)).toEqual({ text: "gpu", filters: {} });
    expect(parseQuery("rahasia:", KEYS)).toEqual({ text: "rahasia:", filters: {} });
  });
  it("input dibatasi 200 karakter dan tidak melempar", () => {
    const q = parseQuery("x".repeat(5000), KEYS);
    expect(q.text.length).toBe(200);
  });
  it("serialize kebalikan parse", () => {
    const q = { text: "gpu", filters: { status: ["menurun"], tim: ["IT Core"] } };
    expect(parseQuery(serializeQuery(q), KEYS)).toEqual(q);
  });
});

describe("search box draft (QueryInput)", () => {
  it("sends the trimmed draft, at most 200 characters, and nothing when it matches the value", () => {
    expect(searchToSend("citra ", "")).toBe("citra");
    expect(searchToSend("citra ", "citra")).toBeNull();
    expect(searchToSend("  ", "")).toBeNull();
    expect(searchToSend("", "citra")).toBe("");
    expect(searchToSend("x".repeat(250), "")).toHaveLength(200);
  });
  it("keeps the typed draft (trailing space included) when the outside value is just the trimmed draft coming back", () => {
    expect(adoptSearch("citra ", "citra")).toBe("citra ");
    expect(adoptSearch("citra r", "citra r")).toBe("citra r");
  });
  it("adopts an outside change that is really different (Back, a removed chip, Clear filters)", () => {
    expect(adoptSearch("citra ", "")).toBe("");
    expect(adoptSearch("citra", "status:down")).toBe("status:down");
  });
});
