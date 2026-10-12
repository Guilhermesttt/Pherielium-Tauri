import { describe, expect, it, vi } from "vitest";
import { toastActionProps } from "./notificationToast";

describe("toastActionProps", () => {
  it("adds no button when the caller passes no action (every existing toast)", () => {
    expect(toastActionProps(undefined)).toBeUndefined();
  });

  it("maps an action to the toast button", () => {
    const onClick = vi.fn();
    const props = toastActionProps({ label: "Entrar", onClick });
    expect(props?.children).toBe("Entrar");
    props?.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
