import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./field";

const html = (note: string | undefined, describedBy?: string) =>
  renderToStaticMarkup(h(Field, { id: "f", label: "Name", note, children: h("input", { id: "f", "aria-describedby": describedBy }) }));

describe("Field", () => {
  it("wires the note to the control by id, after ids the caller passed", () => {
    expect(html("2–40 characters.")).toContain('<input id="f" aria-describedby="f-note"/><span id="f-note"');
    expect(html("2–40 characters.", "f-err")).toContain('aria-describedby="f-err f-note"');
  });
  it("without a note the control is left as it is", () => {
    expect(html(undefined)).toContain('<input id="f"/>');
    expect(html(undefined)).not.toContain("f-note");
  });
});
