let inputLocked = false;

export function setLauncherInputLocked(locked: boolean): void {
  inputLocked = locked;
}

export function isLauncherInputLocked(): boolean {
  return inputLocked;
}
