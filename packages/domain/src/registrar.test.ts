import { describe, expect, it } from "vitest";

import { hasRegistrarAccess, roleHomePath } from "./registrar";

describe("registrar role helpers", () => {
  it("routes registrar and institution administrator roles to the workspace", () => {
    expect(roleHomePath(["registrar"])).toBe("/registrar");
    expect(roleHomePath(["institution_admin"])).toBe("/registrar");
    expect(hasRegistrarAccess(["student", "registrar"])).toBe(true);
  });

  it("routes a student to the student workspace", () => {
    expect(roleHomePath(["student"])).toBe("/student");
  });

  it("keeps unsupported role homes in the honest onboarding state", () => {
    expect(roleHomePath(["instructor"])).toBe("/onboarding");
    expect(roleHomePath([])).toBe("/onboarding");
  });
});
