"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FieldProps {
  label: React.ReactNode;
  /** id of the control; generated when omitted. */
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  /**
   * The control. A single element receives id / aria-describedby /
   * aria-invalid automatically so labels and errors stay associated.
   */
  children: React.ReactElement;
}

/** Label + control + hint + validation message, wired for assistive tech. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const id = htmlFor ?? children.props.id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && (
          <span className="text-danger-fg" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="font-normal text-ink-muted">(optional)</span>}
      </Label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-caption font-medium text-danger-fg">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
