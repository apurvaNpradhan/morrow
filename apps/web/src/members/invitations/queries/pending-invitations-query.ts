import { queryOptions } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

export function pendingInvitationsQueryOptions(email: string | undefined) {
  return queryOptions({
    queryKey: ["invitations", "pending", email],
    queryFn: () => rpc.members.pendingInvitations(),
  });
}
