import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { invalidateWorkspaceDetails } from "@/workspace/cache/invalidate-workspace-queries";
import { useUpdateWorkspace } from "@/workspace/queries/use-update-workspace";
import {
  getWorkspaceDescription,
  normalizeWorkspaceValues,
  type NormalizedWorkspaceValues,
  type WorkspaceFormValues,
} from "./workspace-form-values";

type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  metadata?: unknown;
};

/**
 * The name and description form, saved 1s after the last valid edit and when
 * the page is left. Edits made during a request are queued, never dropped.
 */
export function useWorkspaceAutosave(
  workspace: Workspace | null | undefined,
  canEdit: boolean,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: updateWorkspace } = useUpdateWorkspace();
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<WorkspaceFormValues | null>(null);
  const lastSavedRef = useRef<NormalizedWorkspaceValues | null>(null);
  const workspaceDescription = getWorkspaceDescription(workspace);

  const workspaceSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:workspaceGeneral.validation.nameRequired"))
          .min(2, t("settings:workspaceGeneral.validation.nameShort")),
        description: z.string().optional(),
      }),
    [t],
  );

  const form = useForm<WorkspaceFormValues>({
    resolver: standardSchemaResolver(workspaceSchema),
    mode: "onChange",
    defaultValues: {
      name: workspace?.name || "",
      description: workspaceDescription,
    },
  });

  useEffect(() => {
    if (!workspace) return;

    const nextValues = {
      name: workspace.name || "",
      description: workspaceDescription,
    };
    const server = normalizeWorkspaceValues(nextValues);
    lastSavedRef.current = server;

    // Leave the fields alone while the user is typing, and when they already
    // show the saved text (resetting would strip spaces typed since).
    const shown = normalizeWorkspaceValues(form.getValues());
    const matches =
      shown.name === server.name && shown.description === server.description;
    if (!form.formState.isDirty && !matches) {
      form.reset(nextValues);
    }
  }, [workspace, workspaceDescription, form]);

  const save = useCallback(
    async (data: WorkspaceFormValues) => {
      if (!workspace?.id) return;

      const normalizedData = normalizeWorkspaceValues(data);
      const nameChanged = lastSavedRef.current?.name !== normalizedData.name;
      const descriptionChanged =
        lastSavedRef.current?.description !== normalizedData.description;

      if (!nameChanged && !descriptionChanged) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        await updateWorkspace({
          workspaceId: workspace.id,
          ...(nameChanged && { name: normalizedData.name }),
          ...(descriptionChanged && {
            description: normalizedData.description,
          }),
        });

        lastSavedRef.current = normalizedData;
        // Keep what is on screen: the user may have kept typing during the
        // request. Only when nothing newer is typed does the form become
        // clean; otherwise the pending debounced save sends the rest.
        const shown = normalizeWorkspaceValues(form.getValues());
        if (
          shown.name === normalizedData.name &&
          shown.description === normalizedData.description
        ) {
          form.reset(form.getValues());
        }

        await invalidateWorkspaceDetails(queryClient);
        toast.success(t("settings:workspaceGeneral.toastUpdated"));
      } catch (error) {
        toast.error(
          errorMessage(
            t,
            error,
            t("settings:workspaceGeneral.toastUpdateError"),
          ),
        );
      } finally {
        isSavingRef.current = false;

        if (queuedSaveRef.current) {
          const queuedData = queuedSaveRef.current;
          queuedSaveRef.current = null;
          await save(queuedData);
        }
      }
    },
    [workspace, updateWorkspace, queryClient, form, t],
  );

  const debouncedSave = useCallback(
    (data: WorkspaceFormValues) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        debounceTimeoutRef.current = null;
        void save(data);
      }, 1000);
    },
    [save],
  );

  useEffect(() => {
    if (!canEdit) return;
    const subscription = form.watch(() => {
      if (form.formState.isDirty && form.formState.isValid) {
        debouncedSave(form.getValues());
      }
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave, canEdit]);

  // Leaving the page must not drop an edit still waiting on the debounce.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    return () => {
      if (!debounceTimeoutRef.current) return;
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
      void saveRef.current(form.getValues());
    };
  }, [form]);

  return form;
}
