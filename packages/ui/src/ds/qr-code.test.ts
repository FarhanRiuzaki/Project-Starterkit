import qrcode from "qrcode-generator";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QrCode, qrMatrix } from "./qr-code";

const URI = "otpauth://totp/Example:20101061?secret=JBSWY3DPEHPK3PXP&issuer=Example";

/** The dark modules an SVG path of 1×1 "M{x} {y}h1v1h-1z" squares draws, as "x,y" (quiet zone subtracted). */
function drawn(svg: string, quiet: number): Set<string> {
  const d = /<path[^>]* d="([^"]+)"/.exec(svg)?.[1] ?? "";
  return new Set([...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${Number(m[1]) - quiet},${Number(m[2]) - quiet}`));
}

describe("qrMatrix (qrcode-generator 2.0.4, byte mode, ECC M)", () => {
  it("encodes an otpauth URI into the smallest version that fits (21 + 4 per version modules)", () => {
    const m = qrMatrix(URI);
    expect((m.length - 17) % 4).toBe(0);
    expect(m.length).toBe(37); // 76 bytes at ECC M → version 5 (84 bytes)
    expect(m.every((row) => row.length === m.length)).toBe(true);
  });

  it("has the three finder patterns (7×7, dark ring, light ring, 3×3 core) in the corners", () => {
    const m = qrMatrix(URI);
    const n = m.length;
    const finder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        expect(m[r0 + r]![c0 + c], `${r0 + r},${c0 + c}`).toBe(ring || core);
      }
    };
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
  });

  it("is the same matrix as the encoder's reference API for the same input (a known vector)", () => {
    const ref = qrcode(0, "M");
    ref.addData("HELLO WORLD", "Byte");
    ref.make();
    const m = qrMatrix("HELLO WORLD");
    expect(m.length).toBe(ref.getModuleCount());
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) expect(m[r]![c]).toBe(ref.isDark(r, c));
    // Version 1-M, mask chosen by the encoder: the 15-bit format information is BCH-coded (a valid code word).
    const fmt = [0, 1, 2, 3, 4, 5, 7, 8].map((c) => m[8]![c]).concat([7, 5, 4, 3, 2, 1, 0].map((r) => m[r]![8]));
    const bits = parseInt(fmt.map((b) => (b ? "1" : "0")).join(""), 2) ^ 0b101010000010010;
    expect(bits >> 13).toBe(0b00); // ECC level M
    let rem = bits;
    for (let i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0b10100110111 << (i - 10);
    expect(rem).toBe(0);
  });

  it("refuses data above version 10 (an otpauth URI is far below it)", () => {
    expect(() => qrMatrix("x".repeat(400))).toThrow();
  });
});

describe("<QrCode>", () => {
  it("draws exactly the dark modules as one path, with a 4-module quiet zone, on a light tile in both themes", () => {
    const svg = renderToStaticMarkup(h(QrCode, { value: URI, label: "QR code for your authenticator app" }));
    const m = qrMatrix(URI);
    const want = new Set(m.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`${x},${y}`] : []))));
    expect(drawn(svg, 4)).toEqual(want);
    expect(svg).toContain(`viewBox="0 0 ${m.length + 8} ${m.length + 8}"`);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="QR code for your authenticator app"');
    expect(svg).toMatch(/shape-rendering="crispEdges"/);
  });

  it("never puts the URI or the secret into the markup (only the drawing)", () => {
    const svg = renderToStaticMarkup(h(QrCode, { value: URI, label: "QR code" }));
    expect(svg).not.toContain("otpauth");
    expect(svg).not.toContain("JBSWY3DPEHPK3PXP");
    expect(svg).not.toMatch(/<image|href=|data:/);
  });
});
