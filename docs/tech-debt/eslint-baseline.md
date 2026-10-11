# ESLint baseline (tech debt)

Snapshot taken on 2026-10-11 at commit `3d15192` with `npx eslint .`, excluding
build output (`src-tauri/target`, `dist`, ...). **Not fixed here on purpose**: fixing
it belongs in its own change, never mixed with feature or bug-fix commits.

Acceptance rule until the debt is paid: **no new errors in any file a change touches.**

## Totals: 387 errors, 955 warnings

| Rule | Errors |
| --- | --- |
| `@typescript-eslint/no-unused-vars` | 224 |
| `no-empty` (empty `catch {}`) | 145 |
| `prefer-const` | 7 |
| `react-hooks/rules-of-hooks` | 5 |
| `@typescript-eslint/no-unused-expressions` | 2 |
| `react-hooks/static-components`, `react-hooks/use-memo`, `no-useless-catch`, `@typescript-eslint/ban-ts-comment` | 1 each |

## Worst files

| Errors | File |
| --- | --- |
| 56 | `src/hooks/useVoiceCall.ts` (52 `no-empty`, 4 `no-unused-vars`) |
| 28 | `src/lib/tauriAPI.ts` |
| 28 | `src/pages/SettingsPage.tsx` |
| 25 | `src/pages/Home.tsx` |
| 16 | `src/components/CosmicEasterEgg.tsx` |
| 14 | `src/overlay/OverlayApp.tsx` |
| 12 | `src/components/notch/DesktopNotch.tsx`, `src/services/realtimeEventBus.ts` |
| 7 | `src/components/voice/VoiceCallWindow.tsx` |

Full per-file list: re-run `npx eslint . -f json` and group by `filePath`.

## Files touched by the volume/stream work (baseline before changes)

- `src/hooks/useVoiceCall.ts`: 56
- `src/components/voice/VoiceCallWindow.tsx`: 7

Note: many `no-empty` hits are silent `catch {}` blocks that also violate the
project rule "no empty catch"; fixing them needs typed handling, not just a comment.
