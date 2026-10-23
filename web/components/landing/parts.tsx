import Image from "next/image";
import { Building2, MapPin, Stamp, Truck, UserRound, type LucideIcon } from "lucide-react";
import { PHOTOS, type LandingPhoto } from "@/components/landing/photos";
import { cn } from "@/lib/utils";

/** The four parties that work on a shipment, shared by the landing and auth pages. */
export const ROLES = [
  {
    icon: Building2,
    title: "Shippers",
    org: "Distribution companies",
    text: "Create shipments, award a carrier and clearing agent, approve the quote, then confirm receipt and close.",
    tone: "bg-primary-600 text-white",
  },
  {
    icon: Truck,
    title: "Carriers",
    org: "Transport companies",
    text: "Quote, verify documents, assign a vehicle and driver, and run the journey milestone by milestone.",
    tone: "bg-ink text-white",
  },
  {
    icon: Stamp,
    title: "Clearing agents",
    org: "Customs brokers",
    text: "Upload customs documents, record border and customs milestones, and settle duties and fees.",
    tone: "bg-primary-100 text-primary-700",
  },
  {
    icon: UserRound,
    title: "Drivers",
    org: "Carrier staff",
    text: "See their assignments, record milestones from the road and capture proof of delivery.",
    tone: "bg-surface-sunken text-ink",
  },
];

/**
 * Label that opens each section: an orange icon and a short line of text, no
 * container. `inverse` is for photos and navy surfaces.
 */
export function Eyebrow({
  icon: Icon,
  children,
  className,
  id,
  inverse,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  id?: string;
  inverse?: boolean;
}) {
  return (
    <p
      id={id}
      className={cn(
        "inline-flex w-fit items-center gap-2 text-label font-semibold",
        inverse ? "text-white" : "text-ink",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", inverse ? "text-primary-400" : "text-primary-600")} aria-hidden />
      {children}
    </p>
  );
}

/** Photo set inline with display text, like a word in the sentence. */
export function InlinePhoto({ photo, className }: { photo: LandingPhoto; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-full align-middle", className)}
    >
      <Image src={photo.src} alt="" fill sizes="200px" className="object-cover" />
    </span>
  );
}

/** Location caption for a photo. */
export function PhotoTag({ photo, className }: { photo: LandingPhoto; className?: string }) {
  return (
    <span
      className={cn(
        "glass-dark inline-flex items-center gap-1 rounded-[0.5rem] px-2.5 py-1 text-caption text-white",
        className,
      )}
    >
      <MapPin className="h-3 w-3" aria-hidden />
      {photo.place}
    </span>
  );
}

/** "Four roles, one record" card with the role icons stacked. */
export function RolesPill({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass flex w-fit items-center gap-3 rounded-[1rem] bg-white/90 py-2 pl-2 pr-4",
        className,
      )}
    >
      <ul className="flex -space-x-2">
        {ROLES.map(({ icon: Icon, title, tone }) => (
          <li
            key={title}
            title={title}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-white", tone)}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{title}</span>
          </li>
        ))}
      </ul>
      <p className="text-label leading-tight text-ink">
        <span className="font-semibold">Four roles</span>
        <span className="block text-caption text-ink-muted">one shipment record</span>
      </p>
    </div>
  );
}

/** Illustrative in-transit shipment, clearly labelled as an example. */
export function ExampleShipmentCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass w-[19rem] rounded-card bg-white/90 p-2.5", className)}>
      <div className="relative h-28 overflow-hidden rounded-inset">
        <Image src={PHOTOS.sunsetRoad.src} alt="" fill sizes="300px" className="object-cover" />
        <span className="glass absolute left-2 top-2 rounded-[0.375rem] bg-white/80 px-2 py-0.5 text-overline text-ink-secondary">
          Example shipment
        </span>
      </div>
      <div className="px-1.5 pb-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-label font-semibold text-ink">Mombasa Port → Kigali</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2 py-0.5 text-caption font-medium text-info-fg">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" aria-hidden />
            In transit
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          <div className="fill-hatch h-full w-[68%] rounded-full bg-primary-500" />
        </div>
        <p className="mt-2 text-caption text-ink-muted">
          Latest milestone: <span className="font-medium text-ink-secondary">Border cleared</span>
        </p>
      </div>
    </div>
  );
}
