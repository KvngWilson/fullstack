import { resolveAssetUrl } from "@/utils/resolveAssetUrl";

describe("resolveAssetUrl", () => {
  it("returns absolute http urls unchanged", () => {
    expect(resolveAssetUrl("https://cdn.example.com/image.jpg")).toBe(
      "https://cdn.example.com/image.jpg",
    );
  });

  it("prefixes upload paths with the api origin", () => {
    expect(resolveAssetUrl("/uploads/products/demo.jpg")).toBe(
      "http://localhost:5000/uploads/products/demo.jpg",
    );
  });

  it("passes through empty values", () => {
    expect(resolveAssetUrl("")).toBe("");
    expect(resolveAssetUrl(null)).toBe(null);
  });
});
