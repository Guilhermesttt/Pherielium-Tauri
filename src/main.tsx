// ─── Tauri bridge — MUST be first import ────────────────────────────────────
// Injects window.electronAPI shim so all existing code works unchanged.
import "./lib/tauriAPI";
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
// Fontes embutidas (antes vinham do Google Fonts a cada abertura; Archivo Black e STIX não eram usadas por nenhuma tela).
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/unbounded";
// Números e métricas (ping, FPS, tamanho de arquivo): ver .font-metric em index.css
import "@fontsource-variable/geist-mono";
import "./index.css";
import { applyUiStyle, readUiStyle } from "./lib/uiStyle";

// Estilo visual (refinado por padrão); antes da primeira pintura para não piscar o visual antigo.
applyUiStyle(document.documentElement, readUiStyle());

// Só a janela principal: o canvas nunca fica branco (faixa inferior ao alternar tela
// cheia no WebView2). Não pode ir no index.css: o overlay (transparente) o importa também.
document.documentElement.style.backgroundColor = "var(--surface-base)";
import { Navigate, createHashRouter, RouterProvider, Outlet } from "react-router-dom";
import TitleBar from "./components/layout/TitleBar";

import LoadingState from "./components/ui/loading-state";
import AsyncLoader from "./components/AsyncLoader";

const Login = lazy(() => import("./pages/Login"));
const DesktopAuth = lazy(() => import("./pages/DesktopAuth"));
const AppRoot = lazy(() => import("./App"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
// Laboratório de design: só em desenvolvimento (não entra no instalador).
const DesignLab = import.meta.env.DEV ? lazy(() => import("./pages/DesignLab")) : null;
const DesignLabSettings = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabSettings")) : null;
const DesignLabTrophies = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabTrophies")) : null;
const DesignLabMods = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabMods")) : null;
const DesignLabShell = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabShell")) : null;
const DesignLabDetail = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabDetail")) : null;
const DesignLabConsole = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabConsole")) : null;
const DesignLabCall = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabCall")) : null;
const DesignLabFriends = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabFriends")) : null;
const DesignLabKeyboard = import.meta.env.DEV ? lazy(() => import("./pages/DesignLabKeyboard")) : null;

// In Tauri, we are always in desktop mode
const isDesktopRuntime = true;

const routeFallback = (
  <div className="flex min-h-screen items-center justify-center bg-[var(--tone-0)] text-white">
    <LoadingState label="Iniciando Pherielium" variant="working" />
  </div>
);

// Quem já está logado abre direto no boot do app: carregamento -> animação de abertura -> hub.
// Se não houver sessão, o próprio App redireciona para o login. Sem isto, a tela de login
// aparecia por um instante antes de a sessão ser reconhecida.
const appRouteElement = (
  <Suspense fallback={<AsyncLoader immediate />}>
    <AppRoot />
  </Suspense>
);

const RootLayout: React.FC = () => (
  <div className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--surface-base)] text-white select-none">
    <TitleBar />
    <main className="relative flex-1 w-full overflow-hidden">
      <Outlet />
    </main>
  </div>
);

const desktopRoutes = [
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: appRouteElement,
      },
      {
        path: "login",
        element: (
          <Suspense fallback={routeFallback}>
            <Login />
          </Suspense>
        ),
      },
      {
        path: "desktop-auth",
        element: (
          <Suspense fallback={routeFallback}>
            <DesktopAuth />
          </Suspense>
        ),
      },
      {
        path: "app",
        element: appRouteElement,
      },
      {
        path: "privacy-policy",
        element: (
          <Suspense fallback={routeFallback}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      {
        path: "privacy",
        element: (
          <Suspense fallback={routeFallback}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      ...(DesignLab && DesignLabSettings && DesignLabTrophies && DesignLabMods && DesignLabShell && DesignLabDetail && DesignLabConsole && DesignLabCall && DesignLabFriends && DesignLabKeyboard
        ? [
            {
              path: "design-lab",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLab />
                </Suspense>
              ),
            },
            {
              path: "design-lab/settings",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabSettings />
                </Suspense>
              ),
            },
            {
              path: "design-lab/trophies",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabTrophies />
                </Suspense>
              ),
            },
            {
              path: "design-lab/mods",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabMods />
                </Suspense>
              ),
            },
            {
              path: "design-lab/shell",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabShell />
                </Suspense>
              ),
            },
            {
              path: "design-lab/detail",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabDetail />
                </Suspense>
              ),
            },
            {
              path: "design-lab/console",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabConsole />
                </Suspense>
              ),
            },
            {
              path: "design-lab/call",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabCall />
                </Suspense>
              ),
            },
            {
              path: "design-lab/friends",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabFriends />
                </Suspense>
              ),
            },
            {
              path: "design-lab/keyboard",
              element: (
                <Suspense fallback={routeFallback}>
                  <DesignLabKeyboard />
                </Suspense>
              ),
            },
          ]
        : []),
      {
        path: "*",
        element: <Navigate to="/login" replace />,
      },
    ],
  },
];

// Always use desktop routes — Tauri is always desktop mode
const router = createHashRouter(desktopRoutes, {
  future: {
    v7_relativeSplatPath: true,
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </StrictMode>,
);

