/**
 * Tradução de `NotificationOptions` para as props do toast. Fica fora do componente para ser testável.
 *
 * Regressão que isto protege: o campo `action` era ignorado no caminho do toast (só o overlay o usava). Hoje o único chamador
 * que o passa para `notify` é o convite de call (I0, `useVoiceCall.ts`); qualquer outro toast tem de continuar sem botão.
 */
export interface ToastActionInput {
  label: string;
  onClick: () => void;
}

export function toastActionProps(
  action: ToastActionInput | undefined,
): { children: string; onClick: () => void } | undefined {
  return action ? { children: action.label, onClick: action.onClick } : undefined;
}
