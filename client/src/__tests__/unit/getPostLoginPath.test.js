import { getPostLoginPath } from "@/features/auth/getPostLoginPath";

describe("getPostLoginPath", () => {
  it("routes vendor users to the vendor workspace", () => {
    expect(getPostLoginPath("vendor")).toBe("/vendor");
  });

  it("routes operational employees to the admin workspace", () => {
    expect(getPostLoginPath("admin")).toBe("/admin");
    expect(getPostLoginPath("support")).toBe("/admin");
    expect(getPostLoginPath("warehouse")).toBe("/admin");
    expect(getPostLoginPath("manager")).toBe("/admin");
    expect(getPostLoginPath("super_admin")).toBe("/admin");
    expect(getPostLoginPath("employee")).toBe("/admin");
    expect(getPostLoginPath("finance")).toBe("/admin");
    expect(getPostLoginPath("readonly")).toBe("/admin");
  });

  it("routes everyone else to the customer dashboard", () => {
    expect(getPostLoginPath("customer")).toBe("/dashboard");
    expect(getPostLoginPath(undefined)).toBe("/dashboard");
  });
});
