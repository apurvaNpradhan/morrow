import "./app/lib/instrument";

import { QueryClientProvider } from "@tanstack/react-query";
import { recordLocation } from "./app/navigation/return-location";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { queryClient } from "./app/query-client";
import "@/index.css";
import { useAuth } from "./auth";
import { KeyboardShortcutsHelp } from "./app/components/keyboard-shortcuts-help";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./app/components/theme-provider";
import { applyTheme } from "./app/preferences/apply-theme";
import { readDevicePreferences } from "./app/preferences/use-device-preferences";
import { ErrorBoundary } from "./design-system/ui/error-boundary";
import { AppHotkeysProvider } from "./app/commands";
import { AppI18nProvider } from "./app/i18n/provider";
import { routeTree } from "./routeTree.gen";

console.log(`
                              ////
                         //////////////
                       //////////////////
          ////////    ////////////////////
      /////////////////////////////////////
     //////////////////////        ////////
    //////////////////////          ///////
   ////////      ////////           ///////
   //////         ///////           ///////
   //////         ///////           ///////
   //////         ///////           ///////
   //////         ///////           ///////
   //////         ///////           ///////
   //////         ///////           ///////

  Get ahead of tomorrow.
`);

// Dev-only and lazy: the dynamic import sits behind a build-time constant, so
// production builds drop the devtools code entirely.
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import("./app/components/devtools").then((m) => ({
        default: m.Devtools,
      })),
    )
  : null;

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  context: {
    user: null,
    queryClient,
  },
});

router.subscribe("onResolved", ({ toLocation }) =>
  recordLocation({
    pathname: toLocation.pathname,
    search: toLocation.searchStr,
  }),
);

function App() {
  const { user } = useAuth();

  return <RouterProvider router={router} context={{ user }} />;
}

// Root boundary fallback: shows a generic message and a refresh button,
// without rendering the raw error.message. The full error is still
// captured to Sentry by the boundary itself.
function RootCrashFallback({
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("common:error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common:error.description")}
        </p>
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("common:error.refreshPage")}
        </button>
      </div>
    </div>
  );
}

// Before the first render, so the page never paints in the wrong theme.
applyTheme(readDevicePreferences().theme);

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary fallback={RootCrashFallback}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <AppI18nProvider>
                <AppHotkeysProvider>
                  <App />
                  <KeyboardShortcutsHelp />
                  {Devtools ? (
                    <Suspense fallback={null}>
                      <Devtools router={router} />
                    </Suspense>
                  ) : null}
                </AppHotkeysProvider>
              </AppI18nProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
