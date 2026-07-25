import { describe, expect, it } from "vitest";

import { mapInstitutionAccess } from "./access";

describe("mapInstitutionAccess", () => {
  it("collects active institution roles without trusting auth metadata", () => {
    expect(
      mapInstitutionAccess([
        {
          institution_id: "institution-1",
          role: "registrar",
          institutions: { name: "Northstar University" },
        },
        {
          institution_id: "institution-1",
          role: "institution_admin",
          institutions: { name: "Northstar University" },
        },
      ]),
    ).toEqual({
      institutionId: "institution-1",
      institutionName: "Northstar University",
      roles: ["registrar", "institution_admin"],
    });
  });

  it("rejects unknown roles and missing institution joins", () => {
    expect(
      mapInstitutionAccess([
        {
          institution_id: "institution-1",
          role: "owner",
          institutions: { name: "Northstar University" },
        },
      ]),
    ).toBeNull();
    expect(
      mapInstitutionAccess([
        {
          institution_id: "institution-1",
          role: "registrar",
          institutions: null,
        },
      ]),
    ).toBeNull();
  });
});
