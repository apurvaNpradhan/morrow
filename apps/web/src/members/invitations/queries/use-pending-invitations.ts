import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/auth";
import { isUnauthorizedError } from "@/app/lib/http-error";
import { pendingInvitationsQueryOptions } from "./pending-invitations-query";

export function usePendingInvitations() {
  const { data: session } = authClient.useSession();

  return useQuery({
    ...pendingInvitationsQueryOptions(session?.user?.email),
    enabled: !!session?.user?.email,
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 60000,
  });
}
