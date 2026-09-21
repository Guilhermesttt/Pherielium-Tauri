export type SpatialDirection = "up" | "down" | "left" | "right";

export interface SpatialRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SpatialCandidate<T> {
  id: T;
  rect: SpatialRect;
}

export const rankSpatialCandidates = <T>(
  current: SpatialRect,
  candidates: SpatialCandidate<T>[],
  direction: SpatialDirection,
) => {
  const currentCenterX = current.left + current.width / 2;
  const currentCenterY = current.top + current.height / 2;

  return candidates
    .map((candidate, order) => {
      const { rect } = candidate;
      const candCenterX = rect.left + rect.width / 2;
      const candCenterY = rect.top + rect.height / 2;

      let primaryDelta = 0;
      let secondaryDelta = 0;
      let isCandidateInDirection = false;
      let overlapsSecondary = false;

      switch (direction) {
        case "down":
          isCandidateInDirection = candCenterY > currentCenterY + 2 || rect.top >= current.top + 6;
          primaryDelta = candCenterY - currentCenterY;
          secondaryDelta = Math.abs(candCenterX - currentCenterX);
          overlapsSecondary = rect.right >= current.left && rect.left <= current.right;
          break;

        case "up":
          isCandidateInDirection = candCenterY < currentCenterY - 2 || rect.bottom <= current.bottom - 6;
          primaryDelta = currentCenterY - candCenterY;
          secondaryDelta = Math.abs(candCenterX - currentCenterX);
          overlapsSecondary = rect.right >= current.left && rect.left <= current.right;
          break;

        case "right":
          isCandidateInDirection = candCenterX > currentCenterX + 2 || rect.left >= current.left + 6;
          primaryDelta = candCenterX - currentCenterX;
          secondaryDelta = Math.abs(candCenterY - currentCenterY);
          overlapsSecondary = rect.bottom >= current.top && rect.top <= current.bottom;
          break;

        case "left":
          isCandidateInDirection = candCenterX < currentCenterX - 2 || rect.right <= current.right - 6;
          primaryDelta = currentCenterX - candCenterX;
          secondaryDelta = Math.abs(candCenterY - currentCenterY);
          overlapsSecondary = rect.bottom >= current.top && rect.top <= current.bottom;
          break;
      }

      if (!isCandidateInDirection || primaryDelta <= 0) return null;

      // Overlapping elements on cross-axis get significant priority, but non-overlapping are not rejected
      const alignmentPenalty = overlapsSecondary ? 0 : secondaryDelta * 1.5;
      const score = primaryDelta + alignmentPenalty;

      return {
        ...candidate,
        order,
        score,
        primaryDelta,
        secondaryDelta,
        overlapsSecondary,
      };
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => a.score - b.score || a.primaryDelta - b.primaryDelta || a.order - b.order);
};

export const findDeclaredSpatialNeighbor = (
  root: HTMLElement,
  current: HTMLElement,
  direction: SpatialDirection,
) => {
  const property = `gamepadNav${direction[0].toUpperCase()}${direction.slice(1)}` as
    | "gamepadNavUp"
    | "gamepadNavDown"
    | "gamepadNavLeft"
    | "gamepadNavRight";
  const targetId = current.dataset[property];
  if (!targetId) return null;
  return Array.from(root.querySelectorAll<HTMLElement>("[data-gamepad-id]"))
    .find((element) => element.dataset.gamepadId === targetId) ?? null;
};
