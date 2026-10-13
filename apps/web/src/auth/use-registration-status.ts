import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

export const REGISTRATION_STATUS_QUERY_KEY = ["registration-status"];

export function useRegistrationStatus() {
  return useQuery({
    queryKey: REGISTRATION_STATUS_QUERY_KEY,
    queryFn: () => rpc.auth.registrationStatus(),
  });
}
