import { describe, expect, it } from "vitest";
import { BULK_ALL_MAX as CONTRACT } from "@starterkit/shared/contracts/users";
import { BULK_ALL_MAX } from "./bulk";

describe("bulk", () => {
  it("the client's cap on \"Select all N users\" is the contract's", () => {
    expect(BULK_ALL_MAX).toBe(CONTRACT);
  });
});
