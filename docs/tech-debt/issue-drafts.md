# Issue drafts (ready to paste)

`gh` is not installed on the dev machine, so these were not filed automatically.
Priority order: 1 > 2 > 3 > 4.

## 1. fix(lint): 5 `react-hooks/rules-of-hooks` violations (P1: real bugs)
Hooks called conditionally break React's invariants and can crash at runtime.
- `src/auth/AuthProvider.tsx` (3)
- `src/components/ReactBits/ElasticSlider.tsx` (1)
- `src/components/home/HeroGame.tsx` (1)

Acceptance: `npx eslint . --rule 'react-hooks/rules-of-hooks: error'` reports 0.

## 2. chore(lint): 145 empty `catch {}` blocks (`no-empty`) (P2)
Swallowed errors hide failures (project rule: no empty catch). Worst: `src/hooks/useVoiceCall.ts` (52),
`src/components/notch/DesktopNotch.tsx` (8), `src/services/realtimeEventBus.ts` (9),
`src/services/voiceCall/channelLifecycle.ts` (4). Each needs a deliberate choice: log with context,
return a typed result, or document why ignoring is safe. Do it per file, not with a codemod.

## 3. chore(lint): remaining errors (P3)
224 `@typescript-eslint/no-unused-vars`, 7 `prefer-const`, 2 `no-unused-expressions`,
1 each of `react-hooks/static-components`, `react-hooks/use-memo`, `no-useless-catch`,
`ban-ts-comment`. Mostly mechanical.

## 4. feat(voice): real volume boost above 100% on the LiveKit path (P3)
_Registrado em 2026-10-12 a pedido do dono; fora da V-fix. Nota: o slider de **voz** promete 200% e, no LiveKit, nada muda além de 100% (`el.volume` é limitado a 1,0)._
`HTMLMediaElement.volume` is capped at 1.0, so on LiveKit the voice slider's 100-200% range
does nothing today (only the P2P `PeerAudioNode` path applies gain up to 2.0). Screen-share
audio is capped at 100% in the UI until this lands.
Proposal: apply gain above 100% with `RemoteAudioTrack.setVolume` and `webAudioMix` enabled on the Room, or a
dedicated `GainNode` chain. Either way add a limiter like `PeerAudioNode` (-6 dB threshold,
20:1) to avoid clipping. Saved volumes are stored as the user left them, so no migration is needed.

## Proposal (not applied): block NEW lint errors in CI
ESLint 9.39 supports bulk suppressions (added in 9.24):
1. `npx eslint . --suppress-all` writes `eslint-suppressions.json` with today's errors per file/rule.
2. Commit that file. CI runs plain `npm run lint`; existing errors are suppressed, any new one fails.
3. When a file is cleaned, run `npx eslint . --prune-suppressions` so the count can only go down.
Needs the maintainer's OK because the generated file is large and touches CI.
