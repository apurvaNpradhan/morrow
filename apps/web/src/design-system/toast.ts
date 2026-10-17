import { toastManager } from "./ui/toast";

const DEFAULT_TIMEOUT = 5000;

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick?: () => void;
};

type ToastOptions = {
  description?: string;
  action?: ToastAction;
  cancel?: ToastAction;
};

const openToasts = new Map<string, { id: string; shakes: number }>();

function addToast(
  title: string,
  variant?: ToastVariant,
  options?: ToastOptions,
) {
  let id = "";

  const action = options?.action ?? options?.cancel;
  const key = JSON.stringify([variant, title, options?.description]);
  const open = openToasts.get(key);
  if (open) {
    open.shakes += 1;
    toastManager.update(open.id, {
      timeout: DEFAULT_TIMEOUT,
      data: { shake: open.shakes },
    });
    return open.id;
  }

  id = toastManager.add({
    title,
    description: options?.description,
    type: variant,
    onClose: () => openToasts.delete(key),
    actionProps: action
      ? {
          children: action.label,
          onClick: () => {
            action.onClick?.();
            toastManager.close(id);
          },
        }
      : undefined,
  });

  openToasts.set(key, { id, shakes: 0 });
  return id;
}

type ToastFn = (title: string, options?: ToastOptions) => string;
type ToastId = string;

const success: ToastFn = (title, options) =>
  addToast(title, "success", options);
const error: ToastFn = (title, options) => addToast(title, "error", options);
const info: ToastFn = (title, options) => addToast(title, "info", options);
const warning: ToastFn = (title, options) =>
  addToast(title, "warning", options);
const message: ToastFn = (title, options) =>
  addToast(title, undefined, options);
const loading: ToastFn = (title, options) =>
  toastManager.add({
    title,
    description: options?.description,
    type: "loading",
  });
const dismiss = (id?: ToastId) => {
  if (!id) return;
  toastManager.close(id);
};

const toast = Object.assign(message, {
  success,
  error,
  info,
  warning,
  message,
  loading,
  dismiss,
});

export type { ToastOptions };
export { toast };
