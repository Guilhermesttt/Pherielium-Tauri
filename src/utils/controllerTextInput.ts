export const CONTROLLER_KEYBOARD_EVENT = "checkpoint:controller-keyboard";
export const CONTROLLER_KEYBOARD_VISIBILITY_EVENT = "checkpoint:controller-keyboard-visibility";

export type ControllerTextTarget = HTMLInputElement | HTMLTextAreaElement;

export function isControllerTextTarget(element: Element | null): element is ControllerTextTarget {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return ["text", "search", "email", "url", "password", "tel", "number"].includes(element.type);
}

export function activateElementWithController(element: HTMLElement): void {
  if (isControllerTextTarget(element)) {
    window.dispatchEvent(
      new CustomEvent<{ target: ControllerTextTarget }>(CONTROLLER_KEYBOARD_EVENT, {
        detail: { target: element },
      }),
    );
    return;
  }
  element.click();
}

export function setControllerTextValue(target: ControllerTextTarget, value: string): void {
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}
