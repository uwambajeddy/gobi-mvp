import * as React from "react";

import { cn } from "@/lib/utils";
import { FILE_INPUT_ACCEPT } from "@/lib/files";

/** Native file picker styled to the system; accepts PDF, JPG and PNG by default. */
const FileInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, accept = FILE_INPUT_ACCEPT, ...props }, ref) => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      className={cn(
        "focus-ring block w-full rounded-control text-body text-ink-secondary file:mr-3 file:h-control-sm file:cursor-pointer file:rounded-control file:border-0 file:bg-primary-50 file:px-3 file:text-label file:font-medium file:text-primary-700 hover:file:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
FileInput.displayName = "FileInput";

export { FileInput };
