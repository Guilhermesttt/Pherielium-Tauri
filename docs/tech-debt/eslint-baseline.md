# ESLint baseline (tech debt)

## Comando exato e por que `eslint .` mostra mais

Medição reproduzível (2026-10-12, `main` em `c031d64`):

```
npx eslint . --ignore-pattern "src-tauri/target/**" --ignore-pattern "src-tauri/target-check/**" -f json
```
Resultado: **383 erros, 956 avisos**. Ignores fixos do `eslint.config.js`: `dist`, `coverage`, `ui-ux-pro-max-skill`, `reference`.
Os 387 do baseline foram medidos em `3d15192` com o mesmo critério ("excluindo saída de build"); hoje são 383, 4 a menos. [INFERIDO: código removido desde então; não foi feita bisseção.]

**Por que `npx eslint .` sem ignores dá 1042:** o `eslint.config.js` não ignora `src-tauri/target/`, e a pasta de build do Rust contém JavaScript gerado (**659 erros** ali). 1042 − 659 = 383. Esses 659 não são código do projeto e não entram na conta.
Proposta (não aplicada, é mudança de configuração): adicionar `src-tauri/target` e `src-tauri/target-check` ao `globalIgnores`, para `npm run lint` e a medição coincidirem.

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
