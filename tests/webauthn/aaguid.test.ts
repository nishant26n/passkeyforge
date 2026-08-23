import { describe, expect, it } from "vitest";
import { describeAaguid } from "@/app/lib/webauthn/aaguid";

describe("describeAaguid", () => {
  it("returns null for a missing aaguid", () => {
    expect(describeAaguid(null)).toBeNull();
    expect(describeAaguid(undefined)).toBeNull();
    expect(describeAaguid("")).toBeNull();
  });

  it("returns null for an unrecognized aaguid", () => {
    expect(describeAaguid("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(describeAaguid("not-a-real-aaguid")).toBeNull();
  });

  it("resolves a well-known aaguid to its friendly name", () => {
    expect(describeAaguid("bada5566-a7aa-401f-bd96-45619a55120d")).toBe(
      "1Password",
    );
    expect(describeAaguid("08987058-cadc-4b81-b6e1-30de50dcbe96")).toBe(
      "Windows Hello",
    );
  });

  it("is case-insensitive", () => {
    expect(describeAaguid("BADA5566-A7AA-401F-BD96-45619A55120D")).toBe(
      "1Password",
    );
  });
});
