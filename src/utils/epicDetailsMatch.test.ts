import { describe, expect, it } from "vitest";
import { epicStoreDetailsMatch } from "./epicDetailsMatch";

describe("epicStoreDetailsMatch", () => {
  it("rejects LEGO Fortnite metadata for base Fortnite", () => {
    expect(
      epicStoreDetailsMatch({
        expectedTitle: "Fortnite",
        resultTitle: "LEGO Fortnite Odyssey",
      }),
    ).toBe(false);
  });

  it("accepts exact title match", () => {
    expect(
      epicStoreDetailsMatch({
        expectedTitle: "Fortnite",
        resultTitle: "Fortnite",
      }),
    ).toBe(true);
  });

  it("accepts catalog id match even when titles differ", () => {
    expect(
      epicStoreDetailsMatch({
        expectedCatalogId: "fn:abc123",
        resultCatalogId: "abc123",
        expectedTitle: "Fortnite",
        resultTitle: "Fortnite",
      }),
    ).toBe(true);
  });

  it("accepts LEGO Fortnite when expected title includes LEGO", () => {
    expect(
      epicStoreDetailsMatch({
        expectedTitle: "LEGO Fortnite Odyssey",
        resultTitle: "LEGO Fortnite",
      }),
    ).toBe(true);
  });

  it("accepts launch id match", () => {
    expect(
      epicStoreDetailsMatch({
        expectedLaunchId: "Fortnite",
        resultAppName: "Fortnite",
        expectedTitle: "Fortnite",
        resultTitle: "Something else",
      }),
    ).toBe(true);
  });
});
