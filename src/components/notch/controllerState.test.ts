import { describe, expect, it } from "vitest";
import { cleanControllerName, detectControllerBrand, parseControllerState } from "./controllerState";

describe("controllerState", () => {
  it("reconhece Xbox", () => {
    expect(detectControllerBrand("Xbox 360 Controller (XInput STANDARD GAMEPAD)")).toBe("xbox");
    expect(detectControllerBrand("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)")).toBe("xbox");
  });

  it("reconhece PlayStation (inclusive o nome genérico do Chrome)", () => {
    expect(detectControllerBrand("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")).toBe("playstation");
    expect(detectControllerBrand("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)")).toBe("playstation");
    expect(detectControllerBrand("Wireless Controller")).toBe("playstation");
  });

  it("o resto é genérico", () => {
    expect(detectControllerBrand("USB Gamepad (Vendor: 0079 Product: 0011)")).toBe("generic");
    expect(detectControllerBrand("")).toBe("generic");
    expect(detectControllerBrand(null)).toBe("generic");
  });

  it("limpa o nome", () => {
    expect(cleanControllerName("Xbox 360 Controller (XInput STANDARD GAMEPAD)")).toBe("Xbox 360 Controller");
    expect(cleanControllerName("USB Gamepad  (Vendor: 0079 Product: 0011)")).toBe("USB Gamepad");
  });

  it("valida o payload", () => {
    expect(parseControllerState({ connected: true, brand: "xbox", link: "bluetooth", battery: 85.4, charging: true })).toMatchObject({
      connected: true,
      brand: "xbox",
      link: "bluetooth",
      battery: 85,
      charging: true,
    });
    expect(parseControllerState({ brand: "xbox" })).toBeNull();
    expect(parseControllerState({ connected: false, brand: "nintendo", battery: 500 })).toMatchObject({ brand: "generic", battery: 100 });
  });
});
