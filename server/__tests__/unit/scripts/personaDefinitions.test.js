const {
  PERSONAS,
  SUPPORTED_AUTH_ROLES,
  getInternalRoleDefinitions,
  getPersonaByKey,
} = require("../../../scripts/personaDefinitions");
const { ROLE_PERMISSIONS } = require("../../../domain/identity/policies/PermissionMatrix");

describe("personaDefinitions", () => {
  it("defines unique persona keys and emails", () => {
    const keys = PERSONAS.map((persona) => persona.key);
    const emails = PERSONAS.map((persona) => persona.email);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("uses only supported auth roles and known landing paths", () => {
    for (const persona of PERSONAS) {
      expect(SUPPORTED_AUTH_ROLES).toContain(persona.authRole);
      expect(["/dashboard", "/vendor", "/admin"]).toContain(
        persona.expectedPath,
      );
    }
  });

  it("maps internal personas to seeded employee roles and permissions", () => {
    const internalRoles = getInternalRoleDefinitions();
    const personaKeys = new Set(PERSONAS.map((persona) => persona.key));

    for (const roleDefinition of internalRoles) {
      expect(ROLE_PERMISSIONS[roleDefinition.code]).toEqual(
        roleDefinition.permissionCodes,
      );
    }

    for (const persona of PERSONAS.filter((entry) => entry.employee)) {
      expect(persona.employee.roleCode).toBeTruthy();
      if (persona.employee.managerPersonaKey) {
        expect(personaKeys.has(persona.employee.managerPersonaKey)).toBe(true);
      }
    }
  });

  it("looks up personas by key", () => {
    expect(getPersonaByKey("customer")?.email).toBe(
      "customer.demo@example.com",
    );
    expect(getPersonaByKey("missing")).toBeNull();
  });
});
