import { describe, expect, it } from "vitest";
import { CSV_BOM, csvFileName, toCsv } from "./csv";

describe("toCsv", () => {
  it("mengutip sel berisi koma, kutip, atau baris baru", () => {
    expect(toCsv([["a,b", 'c"d', "e\nf"]])).toBe('"a,b","c""d","e\nf"\r\n');
  });
  it("menetralkan formula spreadsheet (CSV injection)", () => {
    expect(toCsv([["=1+1", "+cmd", "-2", "@SUM(A1)", "\tx", "ok"]])).toBe("'=1+1,'+cmd,'-2,'@SUM(A1),'\tx,ok\r\n");
  });
  it("menetralkan formula dengan spasi/tab/CR di depan", () => {
    expect(toCsv([[" =1+1", "  @x", "\r=1", "\t =2", " -3"]])).toBe("' =1+1,'  @x,\"'\r=1\",'\t =2,' -3\r\n");
    expect(toCsv([["a =1", " ok"]])).toBe("a =1, ok\r\n");
  });
  it("nama berkas memakai tanggal WIB dan BOM UTF-8", () => {
    expect(csvFileName("audit-log", Date.UTC(2026, 9, 17, 18, 0, 0))).toBe("audit-log-2026-10-18.csv");
    expect(csvFileName("fleet", Date.UTC(2026, 9, 17, 16, 59, 0))).toBe("fleet-2026-10-17.csv");
    expect(CSV_BOM).toBe("\uFEFF");
  });
  it("angka dan kosong", () => {
    expect(toCsv([[1, null, undefined, 2.5]])).toBe("1,,,2.5\r\n");
    expect(toCsv([[-3]])).toBe("-3\r\n");
  });
});
