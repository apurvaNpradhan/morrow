import type { AdminUser } from "@/admin/use-admin-users";

export type PendingUserAction = {
  type: "deactivate" | "reactivate" | "delete";
  user: AdminUser;
};
