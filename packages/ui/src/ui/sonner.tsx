"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { Icon } from "./icon";
import { ErrorIcon, InfoIcon, SpinnerIcon, SuccessIcon, WarningIcon } from "./icons";

const Toaster = (props: ToasterProps) => {
  const { resolvedTheme } = useTheme();
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

export { Toaster, toast };
