import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../constants/assets";
import { supabase } from "../services/supabase";
import { LoadingState } from "../components/ui/loading-state";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const DesktopAuth: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state") || "";
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState(
    "Entre com sua conta Google para sincronizar seu Pherielium.",
  );

  const handleGoogleLogin = async () => {
    setStatus("loading");
    setMessage("Aguardando autenticação do Google...");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha ao entrar com Google.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#030405] text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md border border-white/[0.08] bg-[#08090C] rounded-[32px] p-8 md:p-10 shadow-2xl flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6 shadow-inner">
          {status === "done" ? (
            <CheckCircle2 className="w-7 h-7 text-white" />
          ) : status === "error" ? (
            <AlertCircle className="w-7 h-7 text-red-400" />
          ) : (
            <img src={PHERIELIUM_LOGO_PATH} className="w-8 h-8 object-contain" alt="Pherielium" />
          )}
        </div>
        
        <h1 className="text-2xl font-display font-medium tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent">
          Pherielium Hub
        </h1>
        <p className="mt-2 text-xs text-white/50 max-w-xs">{message}</p>

        {status === "loading" && (
          <div className="mt-6">
            <LoadingState label="Validando autenticação Google..." variant="connecting" />
          </div>
        )}

        {status !== "done" && status !== "loading" && (
          <button
            onClick={handleGoogleLogin}
            disabled={!state}
            className="mt-8 w-full bg-white text-black rounded-full py-3.5 px-6 font-display font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-3 hover:scale-102 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
          >
            <GoogleIcon />
            <span>Continuar com Google</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DesktopAuth;

