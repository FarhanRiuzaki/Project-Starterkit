import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { RadioGroup } from "./radio-group";

const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el);

describe("Switch", () => {
  it("is a role=switch button named by the setting, its state in aria-checked, the knob moved when on", () => {
    const on = html(h(Switch, { checked: true, onChange: () => {}, label: "Email me a sign-in alert" }));
    expect(on).toMatch(/<button type="button" role="switch" aria-checked="true" aria-label="Email me a sign-in alert"/);
    expect(on).toContain("translate-x-4");
    expect(html(h(Switch, { checked: false, onChange: () => {}, label: "x" }))).not.toContain("translate-x-4");
  });
});

describe("Textarea", () => {
  it("limit: visible count, announced only near the limit; never blocks typing (no maxlength)", () => {
    const far = html(h(Textarea, { value: "hello", limit: 100, onChange: () => {} }));
    expect(far).not.toContain("maxlength");
    expect(far).toContain("5 of 100 characters");
    expect(far).toMatch(/aria-live="polite"><\/span>/);
    const near = html(h(Textarea, { value: "x".repeat(81), limit: 100, onChange: () => {} }));
    expect(near).toContain("19 characters left");
    expect(near).toMatch(/<textarea[^>]*aria-describedby="[^"]+"/);
  });
  it("past the limit: 'N characters too many', announced, and the field invalid", () => {
    const over = html(h(Textarea, { value: "x".repeat(112), limit: 100, onChange: () => {} }));
    expect(over).toContain("12 characters too many");
    expect(over).toMatch(/<textarea[^>]*aria-invalid="true"/);
  });
  it("without a limit it is a plain textarea", () => {
    expect(html(h(Textarea, { value: "", onChange: () => {} }))).toMatch(/^<textarea/);
  });
});

describe("RadioGroup", () => {
  const opts = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta", description: "Second" }] as const;
  it("native radios in a fieldset named by its legend; the chosen one is checked", () => {
    const out = html(h(RadioGroup, { name: "g", legend: "Pick one", options: opts, value: "b", onChange: () => {} }));
    expect(out).toMatch(/^<fieldset[^>]*><legend[^>]*>Pick one<\/legend>/);
    expect(out.match(/<input(?=[^>]*type="radio")(?=[^>]*name="g")[^>]*>/g)).toHaveLength(2);
    expect(out).toMatch(/<input(?=[^>]*value="b")(?=[^>]*checked="")[^>]*>/);
    expect(out).not.toMatch(/<input(?=[^>]*value="a")(?=[^>]*checked="")[^>]*>/);
  });
  it("an error marks the group invalid and describes it", () => {
    const out = html(h(RadioGroup, { name: "g", legend: "Pick one", options: opts, value: "", onChange: () => {}, error: "Choose an option." }));
    expect(out).toMatch(/<fieldset aria-describedby="g-error" aria-invalid="true"/);
    expect(out).toContain('<p id="g-error"');
  });
});
