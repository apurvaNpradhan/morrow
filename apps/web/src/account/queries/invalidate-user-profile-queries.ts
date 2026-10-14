import type { QueryClient } from "@tanstack/react-query";

const USER_PROFILE_QUERY_KEYS = [["activities"]] as const;

export async function invalidateUserProfileQueries(queryClient: QueryClient) {
  await Promise.all(
    USER_PROFILE_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
