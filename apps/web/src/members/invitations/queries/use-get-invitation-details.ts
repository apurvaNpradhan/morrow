import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";

export function useGetInvitationDetails(invitationId: string | undefined) {
  return useQuery({
    ...orpc.members.publicInvitation.queryOptions({
      input: { id: invitationId ?? "" },
    }),
    enabled: !!invitationId,
  });
}
