"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Icon } from "./icon";
import { ErrorIcon, InfoIcon, SpinnerIcon, SuccessIcon, WarningIcon } from "./icons";
import { toasterMounted } from "./toast";

const Toaster = (props: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  // After sonner's own effect (a child's effects run first) has subscribed: toasts waiting in ./toast go out now.
  useEffect(() => { toasterMounted(true); return () => toasterMounted(false); }, []);
  return (
    <Sonner
      theme={(resolvedTheme ?? "system") as ToasterProps["theme"]}
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <Icon icon={SuccessIcon} className="size-4 text-healthy-ink" />,
        info: <Icon icon={InfoIcon} className="size-4 text-fg-2" />,
        warning: <Icon icon={WarningIcon} className="size-4 text-degraded-ink" />,
        error: <Icon icon={ErrorIcon} className="size-4 text-down-ink" />,
        loading: <Icon icon={SpinnerIcon} className="size-4 animate-spin text-fg-2" />,
      }}
      toastOptions={{ classNames: { toast: "!rounded-lg !border-line !bg-raised !text-fg !shadow-overlay !text-body-sm", description: "!text-fg-2" } }}
      {...props}
    />
  );
};

/** Mounted once, lazily, by the app's Providers. Show toasts with `toast` from `./toast` (loads sonner on demand). */
export { Toaster };
