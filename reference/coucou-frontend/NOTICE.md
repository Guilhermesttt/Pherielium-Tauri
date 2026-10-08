# Coucou frontend (reference copy)

Source: https://github.com/Louis-CFM/coucou (`windows/`), commit copied on 2026-10-08.
Code is MIT-licensed (see `LICENSE`, Copyright Louis Raillé). Keep that notice with any code derived from here.

Deliberately NOT copied (not covered by MIT, see upstream `LICENSE-ASSETS.md`):
- the Mochi character, its animations/outfits (`src/mochi/`), the Coucou name, icons, sounds, screenshots.

Imports of `../mochi/*` in this copy are therefore unresolved on purpose:
replace them with Pherielium's own mascot (Pherie). Do not ship Mochi or the Coucou name.

This folder is excluded from the app build, tsc, vitest and eslint. It is a base to adapt, not live code.

## What Pherielium ported
- `src/core/anim.ts` Spring / easing constants -> `src/mascot/pherie/spring.ts`, `src/mascot/motion.ts` (MIT, credited in the files).
- Visual language only (surface, card wash, motion timings) in the notch. The Pherie is original art; no Mochi asset, sound, name or icon is used.
