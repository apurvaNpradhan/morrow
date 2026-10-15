import { useMemo } from "react";
import { useAuth } from "@/auth";
import { useWorkspaceMembers } from "@/members";

/** A Member as a task shows them: the user's own name, email and picture. */
export type Person = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * The Workspace's current Members, name order, and the signed-in user among
 * them. Assignees are always among these: leaving the Workspace clears them.
 */
export function useWorkspacePeople(workspaceId: string) {
  const { user } = useAuth();
  const members = useWorkspaceMembers(workspaceId);
  return useMemo(() => {
    const people: Person[] = members
      .map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const byId = new Map(people.map((person) => [person.id, person]));
    return { people, byId, meId: user?.id ?? "" };
  }, [members, user?.id]);
}
