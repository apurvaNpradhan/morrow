import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { errorMessage } from "@/app/lib/error-message";
import { useAuth } from "@/auth";
import { toast } from "@/design-system/toast";
import { useUpdateUserProfile } from "@/account/queries/use-update-user-profile";

type ProfileNameValues = { name: string };

/** The name field, saved 1s after the last valid edit and when the page is left. */
export function useProfileNameAutosave() {
  const { t } = useTranslation();
  const { user, refetchUser } = useAuth();
  const { mutateAsync: updateProfile } = useUpdateUserProfile();
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<ProfileNameValues | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:informationPage.validation.nameRequired"))
          .min(2, t("settings:informationPage.validation.nameShort")),
      }),
    [t],
  );

  const form = useForm<ProfileNameValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: { name: user?.name || "" },
  });

  useEffect(() => {
    if (!user) return;
    lastSavedRef.current = (user.name || "").trim();
    if (!form.formState.isDirty) form.reset({ name: user.name || "" });
  }, [user, form]);

  const save = useCallback(
    async (data: ProfileNameValues) => {
      const name = data.name.trim();
      if (lastSavedRef.current === name) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;
      try {
        await updateProfile({ name });
        form.reset({ name }, { keepDirty: false });
        lastSavedRef.current = name;
        queuedSaveRef.current = null;
        await refetchUser();
        toast.success(t("settings:informationPage.updateSuccess"));
      } catch (error) {
        toast.error(
          errorMessage(t, error, t("settings:informationPage.updateError")),
        );
      } finally {
        isSavingRef.current = false;
        if (queuedSaveRef.current) {
          const queued = queuedSaveRef.current;
          queuedSaveRef.current = null;
          await save(queued);
        }
      }
    },
    [t, updateProfile, refetchUser, form],
  );

  useEffect(() => {
    const subscription = form.watch(() => {
      if (!form.formState.isDirty || !form.formState.isValid) return;
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        debounceTimeoutRef.current = null;
        void save(form.getValues());
      }, 1000);
    });
    return () => subscription.unsubscribe();
  }, [form, save]);

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
