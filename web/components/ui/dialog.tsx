"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Prevent closing via Escape/backdrop, e.g. while a request is running. */
  dismissible?: boolean;
}

/**
 * Modal dialog: focus moves into the dialog, Tab is trapped inside it,
 * Escape and the backdrop close it, and focus returns to the trigger.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      "[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    (first ?? panel)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, mounted]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && dismissible) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92vh] w-full animate-pop-in flex-col overflow-hidden rounded-t-panel bg-surface shadow-overlay focus:outline-none sm:rounded-panel",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-4xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
          <div>
            <h2 id={titleId} className="text-heading text-ink">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="mt-1 text-body text-ink-muted">
                {description}
              </div>
            )}
          </div>
          {dismissible && (
            <Button variant="ghost" size="icon-sm" aria-label="Close dialog" onClick={onClose} className="-mr-2 -mt-1">
              <X />
            </Button>
          )}
        </div>
        {children && <div className="overflow-y-auto px-5 py-3 sm:px-6">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line/70 bg-surface-muted px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Replaces window.confirm() with an in-app, accessible confirmation. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep it",
  tone = "default",
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="sm"
      dismissible={!loading}
      title={title}
      description={
        <div className="flex gap-3">
          {tone === "danger" && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-fg">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </span>
          )}
          <div>{description}</div>
        </div>
      }
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "destructive" : "default"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
