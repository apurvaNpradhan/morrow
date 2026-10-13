import type { AdminWorkspaceMember } from "@/admin/lib/admin-types";

export type PendingMemberAction = {
  type: "transfer" | "remove";
  member: AdminWorkspaceMember;
};
