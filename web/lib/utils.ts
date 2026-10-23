import { type ClassValue, clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know the custom design tokens from tailwind.config.ts.
 * Unregistered `text-*` names are treated as colours, so `text-label` would
 * silently delete `text-white` (and vice versa) when classes are merged.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["overline", "caption", "label", "body", "heading", "title", "display"] }],
      rounded: [{ rounded: ["control", "inset", "card", "panel"] }],
      shadow: [{ shadow: ["card", "raised", "overlay", "brand"] }],
    },
    theme: { spacing: ["control-sm", "control", "control-lg", "topbar", "sidebar", "sidebar-collapsed"] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPrice = (price?: number | null) =>
  price == null ? "-" : `${price.toLocaleString()} RWF`;

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

/** Calendar date only, for DATEONLY columns such as expiry dates. */
export const formatDate = (value?: string | null) =>
  value
    ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "-";

/** "3 days ago"; falls back to "-" for missing values. */
export const formatRelative = (value?: string | null) =>
  value ? formatDistanceToNowStrict(new Date(value), { addSuffix: true }) : "-";

export const formatKg = (kg: number) => `${kg.toLocaleString()} kg`;

export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const initials = (first?: string | null, last?: string | null) =>
  `${first?.charAt(0) ?? ""}${last?.charAt(0) ?? ""}`.toUpperCase() || "?";

export const fullName = (person?: { firstName?: string; lastName?: string } | null) =>
  person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() : "";
