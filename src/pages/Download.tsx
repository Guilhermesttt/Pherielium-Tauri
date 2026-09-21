import { ExternalLink, ShieldCheck } from "lucide-react";
import {
  CURRENT_LAUNCHER_VERSION,
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_RELEASES_URL,
  LAUNCHER_EXE_FILENAME,
} from "../constants/downloads";

const DownloadPage = () => {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <section className="relative overflow-hidden px-6 py-24 lg:px-12 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(56,189,248,0.14),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(255,255,255,0.08),transparent_55%)]" />

        <div className="relative mx-auto max-w-5xl">
          <a href="/" className="text-sm text-white/45 transition hover:text-white/75">
            Voltar para o site
          </a>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35 font-ui">
                Download • Versão {CURRENT_LAUNCHER_VERSION}
              </p>
              <h1 className="max-w-3xl text-5xl font-heading font-black tracking-tight text-white lg:text-7xl">
                Baixe o Pherielium para Windows.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55 font-body">
                Acesse a página oficial de lançamentos no GitHub para baixar o instalador oficial (<code className="text-white/80">.exe</code>) da versão v{CURRENT_LAUNCHER_VERSION}, conferir notas de atualização e versões anteriores.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href={GITHUB_LATEST_RELEASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Baixar no GitHub Releases
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-white/15 px-7 py-4 text-sm font-bold text-white/75 transition hover:border-white/30 hover:text-white"
                >
                  Ver todas as versões
                </a>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-2xl">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <ShieldCheck className="h-5 w-5 text-white/75" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Distribuição Oficial via GitHub</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Instaladores assinados, código aberto e histórico de versões disponíveis no GitHub Releases.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
                    Arquivo do instalador
                  </p>
                  <p className="text-sm font-mono text-white/75">{LAUNCHER_EXE_FILENAME}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default DownloadPage;
