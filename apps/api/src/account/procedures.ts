import { type } from "@orpc/server";
import { z } from "zod";
import { authApi } from "#api/platform/orpc/auth-api";
import { authed } from "#api/platform/orpc/base";
import { deleteAvatar } from "./operations/delete-avatar";
import { getCurrentUser } from "./operations/get-current-user";
import { saveAvatar } from "./operations/save-avatar";
import { exportAccountData } from "./operations/export-data";
import {
  avatarDeletedSchema,
  avatarSchema,
  currentUserSchema,
} from "./response";

const accountExportSchema = z.object({
  exportedAt: z.date(),
  profile: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      image: z.string().nullable(),
      createdAt: z.date(),
    })
    .nullable(),
  memberships: z.array(
    z.object({
      workspaceId: z.string(),
      workspaceName: z.string(),
      role: z.string(),
      joinedAt: z.date().nullable(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      workspaceId: z.string(),
      resourceType: z.string(),
      resourceId: z.string(),
      type: z.string(),
      content: z.string().nullable(),
      eventData: z.unknown(),
      createdAt: z.date(),
    }),
  ),
});

export const me = authed
  .output(currentUserSchema)
  .handler(({ context }) => getCurrentUser(context.userId));

export const uploadAvatar = authed
  .input(z.object({ file: z.instanceof(Blob) }))
  .output(avatarSchema)
  .handler(({ context, input }) => saveAvatar(context.userId, input.file));

export const removeAvatar = authed
  .output(avatarDeletedSchema)
  .handler(({ context }) => deleteAvatar(context.userId));

export const exportData = authed
  .output(accountExportSchema)
  .handler(({ context }) => exportAccountData(context.user));

export const updateProfile = authed
  .input(
    z.object({
      name: z.string().trim().min(1).max(200).optional(),
      locale: z.string().max(35).optional(),
    }),
  )
  .output(z.object({ status: z.boolean() }))
  .handler(async ({ context, input }) =>
    (await authApi()).updateUser({ headers: context.authHeaders, body: input }),
  );

export const deleteAccount = authed
  .output(type<unknown>())
  .handler(async ({ context }) =>
    (await authApi()).deleteUser({ headers: context.authHeaders, body: {} }),
  );

export const accountRouter = {
  updateProfile,
  deleteAccount,
  me,
  uploadAvatar,
  removeAvatar,
  export: exportData,
};
