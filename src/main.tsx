// ─── Tauri bridge — MUST be first import ────────────────────────────────────
// Injects window.electronAPI shim so all existing code works unchanged.
import "./lib/tauriAPI";
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/archivo-black/400.css";
import "@fontsource/stix-two-text/400.css";
import "@fontsource/stix-two-text/700.css";
import "./index.css";
import { Navigate, createHashRouter, RouterProvider, Outlet } from "react-router-dom";
import TitleBar from "./components/layout/TitleBar";

import LoadingState from "./components/ui/loading-state";

const Login = lazy(() => import("./pages/Login"));
const DesktopAuth = lazy(() => import("./pages/DesktopAuth"));
const AppRoot = lazy(() => import("./App"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

// In Tauri, we are always in desktop mode
const isDesktopRuntime = true;

const routeFallback = (
  <div className="flex min-h-screen items-center justify-center bg-[#030405] text-white">
    <LoadingState label="Iniciando Pherielium" variant="working" />
  </div>
);

const RootLayout: React.FC = () => (
  <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#070707] text-white select-none">
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
        element: <Navigate to="/login" replace />,
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
        element: (
          <Suspense fallback={routeFallback}>
            <AppRoot />
          </Suspense>
        ),
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

