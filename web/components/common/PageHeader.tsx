import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/** Page title block shared by every dashboard page. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded-md text-label text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> {back.label}
          </Link>
        )}
        {eyebrow && <p className="mb-1 text-overline text-primary-600">{eyebrow}</p>}
        <h1 className="font-display text-title font-bold text-ink md:text-[1.75rem] md:leading-9">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}

/** Small heading for groups inside a page. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-overline text-ink-muted", className)}>{children}</p>;
}
