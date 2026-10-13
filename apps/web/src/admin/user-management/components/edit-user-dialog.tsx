import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUser } from "@/admin/use-admin-users";
import { useUpdateAdminUser } from "@/admin/user-management/queries/use-update-admin-user";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Field, FieldLabel } from "@/design-system/ui/field";
import { Input } from "@/design-system/ui/input";

export function EditUserDialog({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: updateUser, isPending } = useUpdateAdminUser();
  const [values, setValues] = useState({ name: "", email: "" });

  useEffect(() => {
    if (user) setValues({ name: user.name, email: user.email });
  }, [user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const name = values.name.trim();
    const email = values.email.trim().toLowerCase();
    if (!name || !email) return;

    try {
      await updateUser({ userId: user.id, name, email });
      onClose();
    } catch {
      // The mutation reports the failure; keep the dialog open to retry.
    }
  };

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("settings:adminUsers.edit.title")}</DialogTitle>
            <DialogDescription>
              {t("settings:adminUsers.edit.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="admin-user-name">
                  {t("settings:adminUsers.edit.name")}
                </FieldLabel>
                <Input
                  id="admin-user-name"
                  name="name"
                  type="text"
                  required
                  value={values.name}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-user-email">
                  {t("settings:adminUsers.edit.email")}
                </FieldLabel>
                <Input
                  id="admin-user-email"
                  name="email"
                  type="email"
                  required
                  value={values.email}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="ghost" />}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("settings:adminUsers.edit.saving")
                : t("settings:adminUsers.edit.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
