import React from "react";
import { AlertTriangle, Copy, Check } from "lucide-react";
import ModalShell from "../ui/ModalShell";

interface AppUpdateErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
}

export const AppUpdateErrorModal: React.FC<AppUpdateErrorModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(errorMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Detalhes Técnicos do Erro de Atualização"
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-4 p-6 bg-[#090909] rounded-3xl border border-white/10 text-white shadow-2xl">
        <h3 className="text-lg font-bold tracking-tight text-white">
          Detalhes Técnicos do Erro de Atualização
        </h3>

        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            Ocorreu uma falha ao tentar processar ou validar o pacote de atualização.
            Abaixo estão os detalhes do erro retornados pelo sistema para diagnóstico.
          </p>
        </div>

        <div className="relative">
          <div className="flex items-center justify-between rounded-t-xl border border-white/10 bg-black/60 px-4 py-2 text-[10px] font-black uppercase text-white/50">
            <span>Stack / Log do Erro</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:bg-white/20 active:scale-95"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-b-xl border border-t-0 border-white/10 bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-red-300/90 no-scrollbar">
            {errorMessage || "Nenhum detalhe adicional disponível."}
          </pre>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-white px-5 py-2 text-xs font-black uppercase tracking-wider text-black transition-all hover:bg-white/90 active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
