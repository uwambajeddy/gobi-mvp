"use client";

import { cn } from "@/lib/utils";
import { useRoleTheme } from "@/hooks/useRoleTheme";

const sizes = {
  sm: "h-7 w-7 rounded-[0.5rem] [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-10 w-10 rounded-[0.75rem] [&_svg]:h-5 [&_svg]:w-5 sm:h-12 sm:w-12 sm:rounded-[0.875rem] sm:[&_svg]:h-6 sm:[&_svg]:w-6",
};

/** The workspace role's mark on its accent tile, like a vest's colour patch. */
export function RoleEmblem({ size = "lg", className }: { size?: keyof typeof sizes; className?: string }) {
  const { Emblem } = useRoleTheme();
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-role-accent text-role-on-accent shadow-role transition-colors duration-500",
        sizes[size],
        className,
      )}
    >
      <Emblem />
    </span>
  );
}
