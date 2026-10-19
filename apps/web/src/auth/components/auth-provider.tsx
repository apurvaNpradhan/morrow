import * as Sentry from "@sentry/react";
import {
  createContext,
  type PropsWithChildren,
  useEffect,
  useRef,
} from "react";
import { authClient } from "@/auth/lib/auth-client";
import { forgetSession } from "@/auth/lib/session";
import { readOwnerStamp } from "@/app/sync/owner-stamp";
import type { User } from "@/app/lib/user";
import { LoadingSkeleton } from "@/design-system/ui/loading-skeleton";

const { useSession } = authClient;

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
}>({
  user: undefined,
  isLoading: true,
  refetchUser: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending, refetch, error } = useSession();
  // Only show the loading skeleton during the *first* session fetch. Better
  // Auth re-fetches the session on window focus; if we kept returning the
  // skeleton while those background fetches are pending we'd unmount the
  // entire route tree on every alt-tab, which tore down the Turnstile
  // iframe and forced a re-challenge.
  const hasLoadedOnce = useRef(false);
  if (!isPending) {
    hasLoadedOnce.current = true;
  }

  // Tag transient Safari "Load failed" errors during the session fetch so
  // instrument.ts's beforeSend can drop them. Better Auth's useSession
  // uses nanostores rather than TanStack Query, so the query client's
  // network-error cooldown doesn't reach this path. Real auth failures
  // (e.g. 401) still surface to Sentry through Better Auth.
  useEffect(() => {
    if (error instanceof Error && error.message.includes("Load failed")) {
      Sentry.captureException(error, { tags: { area: "auth.session" } });
    }
  }, [error]);

  // A browser that holds a signed-in user's database renders from the owner
  // stamp's copy of the user while the session is checked.
  const stamped = isPending ? readOwnerStamp() : null;
  if (isPending && !hasLoadedOnce.current && !stamped) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider
      value={{
        user:
          ((data?.user ?? stamped?.user) as User | null | undefined) ?? null,
        isLoading: isPending,
        refetchUser: async () => {
          forgetSession();
          await refetch({ query: { disableCookieCache: true } });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
