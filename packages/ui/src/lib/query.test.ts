import { describe, expect, it } from "vitest";
import { parseQuery, serializeQuery } from "./query";

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
