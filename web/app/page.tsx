import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Cable,
  CircleCheck,
  Eye,
  FileCheck,
  Info,
  Layers,
  ListChecks,
  MapPin,
  PackageCheck,
  Plus,
  Route,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { LifecycleStepper } from "@/components/shipments/LifecycleStepper";
import { HERO_PHOTO, PHOTO_LIST, PHOTOS, type LandingPhoto } from "@/components/landing/photos";
import { HeroRain } from "@/components/landing/HeroRain";
import { MilestoneRoute } from "@/components/landing/MilestoneRoute";
import {
  ExampleShipmentCard,
  Eyebrow,
  InlinePhoto,
  PhotoTag,
  ROLES,
  RolesPill,
} from "@/components/landing/parts";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "#platform", label: "Platform" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#lifecycle", label: "Lifecycle" },
  { href: "#roles", label: "Who it's for" },
];

const CAPABILITIES = [
  {
    title: "One operational timeline",
    description:
      "Every milestone (pickup, checkpoint, border, customs, warehouse, proof of delivery) becomes structured data: who, when, where, evidence.",
  },
  {
    title: "Document control",
    description:
      "A required-documents checklist per shipment with upload, verification and rejection. Nothing moves until the checklist is green.",
  },
  {
    title: "Compliance gates",
    description:
      "Dispatch is blocked on expired licences, insurance, inspections or overloads, and can only be overridden with an audited justification.",
  },
  {
    title: "Cross-border visibility",
    description:
      "Border, customs and warehouse milestones are recorded as they happen and shared with every party, including the clearing agent.",
  },
  {
    title: "Payments & exceptions",
    description:
      "Record duties, port and border fees against the shipment, and track breakdowns, customs holds or border queues until they are resolved.",
  },
  {
    title: "Full auditability",
    description:
      "Every action is logged with actor, role, organization and evidence. Nothing important lives only in WhatsApp.",
  },
];

const PHASES = [
  {
    step: "01",
    title: "Create & award",
    description:
      "The shipper creates the shipment with packages and route, assigns a carrier and clearing agent, and approves the quote.",
    photo: PHOTOS.portContainer,
  },
  {
    step: "02",
    title: "Documents & gates",
    description:
      "Parties upload against the required checklist. The carrier verifies documents, and the compliance gate checks driver and vehicle before dispatch.",
    photo: PHOTOS.bridgeTanker,
  },
  {
    step: "03",
    title: "Execute & record",
    description:
      "The journey is recorded milestone by milestone (checkpoints, borders, customs, warehouse) down to proof of delivery and closure.",
    photo: PHOTOS.corridorRoad,
  },
];

const RULES = [
  { icon: FileCheck, title: "Document gate", text: "Mandatory documents in place before dispatch" },
  { icon: ShieldCheck, title: "Compliance gate", text: "Licence, insurance, inspection and payload checked" },
  { icon: PackageCheck, title: "Closure rule", text: "Proof of delivery and no open exceptions" },
];

/** Illustrative timeline for the lifecycle preview; real shipments record their own. */
const SAMPLE_TIMELINE = [
  { label: "Picked up", place: "Port of Mombasa", time: "Mon 08:10" },
  { label: "Border cleared", place: "Malaba", time: "Wed 14:35" },
  { label: "Customs released", place: "Gatuna", time: "Fri 11:05" },
];

const MARQUEE: (string | LandingPhoto)[] = [
  "One timeline",
  PHOTOS.sunsetRoad,
  "One checklist",
  PHOTOS.portCrew,
  "One audit trail",
  PHOTOS.bridgeTanker,
];

/** Page-width wrapper shared by every section. */
const wrap = "mx-auto w-full max-w-[78rem] px-5 sm:px-8";

const headingClasses = "font-poster text-[2.75rem] text-ink sm:text-[3.5rem]";

function RouteStop({ label, place, country }: { label: string; place: string; country: string }) {
  return (
    <div>
      <p className="text-caption text-ink-muted">{label}</p>
      <div className="tile mt-1 flex items-center gap-2.5 rounded-inset px-3 py-2.5">
        <MapPin className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-label font-semibold text-ink">{place}</p>
          <p className="text-caption text-ink-muted">{country}</p>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen overflow-x-clip">
      {/* Hero */}
      <section className="p-2 sm:p-3">
        <div className="relative isolate flex min-h-[42rem] flex-col overflow-hidden rounded-[1.75rem] bg-ink sm:rounded-[2rem] lg:min-h-[min(54rem,calc(100svh-1.5rem))]">
          <Image
            src={HERO_PHOTO.src}
            alt={HERO_PHOTO.alt}
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="-z-10 object-cover object-[75%_center]"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-ink/45 md:hidden" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/0" />
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-ink/60 to-transparent" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-72 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent" />
          {/* Rain falls in front of the shading too, so it carries across the copy side. */}
          <HeroRain />

          {/* One frosted bar across the top of the photo; radius is the hero's minus its inset. */}
          <header className="relative z-10 p-2 sm:p-3">
            <div className="glass-dark relative flex items-center justify-between gap-3 rounded-[1.25rem] py-2 pl-3.5 pr-2 sm:rounded-[1.5rem] sm:pl-5">
              <Link href="/" aria-label="Gobi home" className="focus-ring rounded-control">
                <Logo inverse />
              </Link>
              <nav aria-label="Page sections" className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
                <ul className="flex items-center gap-0.5">
                  {SECTIONS.map(({ href, label }) => (
                    <li key={href}>
                      <a
                        href={href}
                        className="focus-ring block rounded-control px-4 py-1.5 text-label text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button variant="ghost" size="sm" asChild className="text-white hover:bg-white/15 hover:text-white">
                  <Link href="/signin">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Get started</Link>
                </Button>
              </div>
            </div>
          </header>

          <div className={cn(wrap, "flex flex-1 flex-col justify-center py-14")}>
            <Eyebrow icon={Route} inverse className="animate-fade-up">
              Shipment coordination for domestic &amp; cross-border freight
            </Eyebrow>
            <h1 className="font-poster mt-6 animate-fade-up text-[3.25rem] leading-[0.9] text-white [animation-delay:80ms] sm:text-[5.25rem] lg:text-[6.75rem]">
              <span className="block">
                Every shipment,{" "}
                <InlinePhoto
                  photo={PHOTOS.portCrew}
                  className="hidden h-[0.7em] w-[1.6em] -translate-y-[0.08em] ring-2 ring-white/80 sm:inline-block"
                />
              </span>
              <span className="block">
                <InlinePhoto
                  photo={PHOTOS.corridorRoad}
                  className="hidden h-[0.7em] w-[1.6em] -translate-y-[0.08em] ring-2 ring-white/80 sm:inline-block"
                />{" "}
                every border,
              </span>
              <span className="block text-primary-400">one record.</span>
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-[1.0625rem] leading-relaxed text-white/80 [animation-delay:160ms]">
              Gobi is the coordination workspace for shippers, carriers, clearing agents and drivers: one
              timeline, one document checklist and one audit trail per shipment, from pickup to proof of
              delivery.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col gap-3 [animation-delay:240ms] sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Set up your workspace <ArrowRight />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                asChild
                className="glass-dark text-white hover:bg-ink/60 hover:text-white"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>

          {/* Floating cards */}
          <div className="relative z-10 flex items-end justify-between gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <RolesPill />
            <ExampleShipmentCard className="hidden lg:block" />
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section aria-labelledby="milestones-title" className={cn(wrap, "py-16")}>
        <div className="text-center">
          <Eyebrow id="milestones-title" icon={ListChecks}>
            Recorded on every shipment timeline
          </Eyebrow>
        </div>
        <MilestoneRoute />
      </section>

      {/* About */}
      <section aria-labelledby="about-title" className={cn(wrap, "pb-20")}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
          <div className="flex flex-col">
            <Eyebrow icon={Info}>About Gobi</Eyebrow>
            <h2 id="about-title" className={cn("mt-4 max-w-lg", headingClasses)}>
              Your shipment&apos;s single source of truth
            </h2>
            <p className="mt-4 max-w-lg text-[1rem] leading-relaxed text-ink-muted">
              Freight is still coordinated over phone calls, spreadsheets and WhatsApp groups. Gobi turns that
              coordination into structured, shared data, so the shipper, carrier, clearing agent and driver all
              work from the same facts.
            </p>
            <div className="mt-auto grid gap-4 pt-10 sm:grid-cols-2">
              <article className="bg-contours rounded-card bg-ink p-6 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_12px_28px_-10px_rgb(15_26_51/0.35)] ring-1 ring-inset ring-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-white/10">
                  <Eye className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-poster mt-10 text-[1.625rem]">Visibility before automation</h3>
                <p className="mt-1.5 text-body text-white/70">
                  The problem isn&apos;t the lack of GPS. It&apos;s the lack of operational visibility, so Gobi
                  structures the work first.
                </p>
              </article>
              <article className="glass rounded-card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-primary-50 text-primary-600">
                  <Cable className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-poster mt-10 text-[1.625rem] text-ink">Manual-first, integration-ready</h3>
                <p className="mt-1.5 text-body text-ink-muted">
                  Coordinators record events by hand today. GPS, customs and payment integrations can write the
                  same events tomorrow.
                </p>
              </article>
            </div>
          </div>

          <div className="relative isolate flex min-h-[32rem] flex-col justify-between overflow-hidden rounded-panel bg-ink p-4 sm:p-6">
            <Image
              src={PHOTOS.portTruck.src}
              alt={PHOTOS.portTruck.alt}
              fill
              placeholder="blur"
              sizes="(min-width: 1025px) 40vw, 100vw"
              className="-z-10 object-cover object-[30%_center]"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
            <div className="glass ml-auto w-full max-w-[19rem] rounded-card bg-white/90 p-4">
              <p className="text-overline text-ink-muted">Example route</p>
              <div className="mt-3">
                <RouteStop label="Pickup" place="Port of Mombasa" country="Kenya" />
                <div className="-my-1.5 flex justify-center" aria-hidden>
                  <span className="relative z-10 mt-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-4 ring-white">
                    <ArrowDownUp className="h-3.5 w-3.5" />
                  </span>
                </div>
                <RouteStop label="Delivery" place="Kigali" country="Rwanda" />
              </div>
              <p className="tile mt-3 flex items-center gap-2 rounded-inset px-3 py-2 text-caption text-ink-secondary">
                <FileCheck className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                Cross-border: ten-document checklist
              </p>
            </div>
            <PhotoTag photo={PHOTOS.portTruck} className="w-fit" />
          </div>
        </div>
      </section>

      {/* Platform */}
      <section
        id="platform"
        aria-labelledby="platform-title"
        className="glass mx-2 rounded-[1.75rem] py-20 sm:mx-3 sm:rounded-[2rem]"
      >
        <div className={cn(wrap, "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16")}>
          <div>
            <Eyebrow icon={Layers}>Platform</Eyebrow>
            <h2 id="platform-title" className={cn("mt-4 max-w-lg", headingClasses)}>
              Everything a shipment needs, in one workspace
            </h2>
            <p className="mt-4 max-w-lg text-[1rem] leading-relaxed text-ink-muted">
              Gobi structures the coordination work that lives in phone calls and spreadsheets today, without
              asking anyone to install hardware first.
            </p>
            <div className="relative isolate mt-8 aspect-[4/3] overflow-hidden rounded-panel bg-ink">
              <Image
                src={PHOTOS.portCrew.src}
                alt={PHOTOS.portCrew.alt}
                fill
                placeholder="blur"
                sizes="(min-width: 1025px) 45vw, 100vw"
                className="-z-10 object-cover"
              />
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
                <p className="glass flex items-center gap-2.5 rounded-inset bg-white/90 py-1.5 pl-1.5 pr-4 text-label font-medium text-ink">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[0.5rem] bg-success-soft text-success-fg">
                    <CircleCheck className="h-4 w-4" aria-hidden />
                  </span>
                  Nothing moves until the checklist is green
                </p>
                <PhotoTag photo={PHOTOS.portCrew} className="hidden sm:inline-flex" />
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:pt-16">
            {CAPABILITIES.map(({ title, description }, index) => (
              <details
                key={title}
                name="capabilities"
                open={index === 0}
                className="group rounded-card border border-white/80 bg-white/40 transition-colors open:border-transparent open:bg-surface open:shadow-raised"
              >
                <summary className="focus-ring flex cursor-pointer list-none items-center gap-4 rounded-card p-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-label font-semibold text-primary-600">
                    {String(index + 1).padStart(2, "0")}.
                  </span>
                  <span className="flex-1 text-heading text-ink">{title}</span>
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-300 text-primary-600 transition-[transform,background-color,color] duration-200 group-open:rotate-45 group-open:border-primary-600 group-open:bg-primary-600 group-open:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>
                <p className="-mt-1 px-5 pb-5 text-body text-ink-muted sm:pl-[3.75rem] sm:pr-14">{description}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-title" className={cn(wrap, "py-20")}>
        <div className="text-center">
          <Eyebrow icon={Workflow}>How it works</Eyebrow>
          <h2 id="how-title" className={cn("mx-auto mt-4 max-w-xl", headingClasses)}>
            Three phases, one record
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1rem] leading-relaxed text-ink-muted">
            Each phase hands over to the next on the same shipment, so nobody has to ask where things stand.
          </p>
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3 md:items-end">
          {PHASES.map(({ step, title, description, photo }, index) => (
            <li
              key={step}
              className={cn(
                "group relative isolate flex min-h-[27rem] flex-col justify-between overflow-hidden rounded-panel bg-ink p-2.5 text-white",
                index === 1 && "md:min-h-[31rem]",
              )}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                placeholder="blur"
                sizes="(min-width: 768px) 33vw, 100vw"
                className="-z-10 object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/75 via-ink/0 to-ink/45" />
              {/* Title set on the photo, poster-style. */}
              <h3 className="font-poster p-3 text-[2.5rem] sm:p-4">
                <span className={index === 1 ? "text-primary-400" : "text-white/60"}>{step}/</span>
                <span className="block">{title}</span>
              </h3>
              {/* Caption on frosted glass; radius is the card's minus its inset. */}
              <div className="glass-dark rounded-inset p-4 sm:p-5">
                <p className="text-body text-white/85">{description}</p>
                <p className="mt-3 flex items-center gap-1 text-caption text-white/60">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {photo.place}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Lifecycle */}
      {/* Navy band, the sidebar's surface, to break up the light sections. */}
      <section
        id="lifecycle"
        aria-labelledby="lifecycle-title"
        className="bg-contours relative isolate mx-2 overflow-hidden rounded-[1.75rem] bg-ink py-20 text-white sm:mx-3 sm:rounded-[2rem]"
      >
        <div className={cn(wrap, "grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16")}>
          <div>
            <Eyebrow icon={ShieldCheck} inverse>
              Built-in rules
            </Eyebrow>
            <h2 id="lifecycle-title" className={cn("mt-4 max-w-lg", headingClasses, "text-white")}>
              The lifecycle is enforced, not suggested
            </h2>
            <p className="mt-4 max-w-lg text-[1rem] leading-relaxed text-white/70">
              Every shipment moves from draft to completion through ten stages. Three rules decide when it may move
              forward, and compliance overrides need a written justification that lands in the audit log.
            </p>
            <ul className="mt-8 space-y-3">
              {RULES.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex items-center gap-4 rounded-card bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary-600 text-white shadow-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-heading text-white">{title}</p>
                    <p className="text-body text-white/65">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary-500/35 via-primary-500/10 to-transparent blur-2xl sm:-inset-6" />
            <div className="rounded-panel bg-surface p-5 shadow-overlay ring-1 ring-ink/5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-overline text-ink-muted">Example shipment</p>
                  <p className="mt-1 text-heading text-ink">Mombasa Port → Kigali</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-caption font-medium text-info-fg">
                  <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden />
                  In transit
                </span>
              </div>
              <div className="mt-6">
                <LifecycleStepper status="in_transit" size="sm" />
              </div>
              <ol className="mt-6 space-y-0 border-t border-line/70 pt-5">
                {SAMPLE_TIMELINE.map(({ label, place, time }, index) => (
                  <li key={label} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < SAMPLE_TIMELINE.length - 1 && (
                      <span aria-hidden className="absolute left-[0.4375rem] top-5 h-[calc(100%-1rem)] w-px bg-line" />
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2",
                        index === SAMPLE_TIMELINE.length - 1
                          ? "border-primary-500 bg-primary-500 ring-4 ring-primary-100"
                          : "border-line-strong bg-surface",
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                      <p className="text-label text-ink">
                        <span className="font-semibold">{label}</span>
                        <span className="text-ink-muted"> · {place}</span>
                      </p>
                      <time className="shrink-0 text-caption text-ink-subtle">{time}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" aria-labelledby="roles-title" className={cn(wrap, "py-20")}>
        <div className="text-center">
          <Eyebrow icon={Users}>Who it&apos;s for</Eyebrow>
          <h2 id="roles-title" className={cn("mx-auto mt-4 max-w-2xl", headingClasses)}>
            Every party on the shipment, on the same page
          </h2>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLES.map(({ icon: Icon, title, org, text, tone }) => (
            <li
              key={title}
              className="glass rounded-card p-6 transition-[background-color,transform] duration-200 hover:-translate-y-1 hover:bg-white/80"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", tone)}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-caption text-ink-muted">{org}</span>
              </div>
              <h3 className="font-poster mt-8 text-[1.875rem] text-ink">{title}</h3>
              <p className="mt-2 text-body text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Marquee */}
      <section aria-label="One timeline, one checklist, one audit trail" className="overflow-hidden pb-20">
        <div className="flex w-max animate-marquee items-center hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden className="flex shrink-0 items-center gap-6 pr-6 sm:gap-10 sm:pr-10">
              {MARQUEE.map((item, index) =>
                typeof item === "string" ? (
                  <span
                    key={item}
                    className={cn(
                      "font-poster whitespace-nowrap text-[3.5rem] sm:text-[6rem]",
                      index === 2 ? "text-primary-600" : "text-ink",
                    )}
                  >
                    {item}
                  </span>
                ) : (
                  <InlinePhoto key={item.title} photo={item} className="h-14 w-32 sm:h-20 sm:w-48" />
                ),
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-2 pb-2 pt-3 sm:px-3 sm:pb-3">
        <div className="overflow-hidden rounded-[1.75rem] bg-ink text-white sm:rounded-[2rem]">
          <div className={cn(wrap, "grid gap-10 pb-12 pt-14 md:grid-cols-2 md:gap-16")}>
            <div className="flex flex-col items-start">
              <Logo inverse />
              <p className="mt-4 max-w-sm text-body text-white/70">
                Shipment coordination for shippers, carriers, clearing agents and drivers.
              </p>
              <Button size="lg" asChild className="mt-8">
                <Link href="/signup">
                  Create your workspace <ArrowRight />
                </Link>
              </Button>
            </div>
            {/* Stacked poster links, ruled like a manifest. */}
            <nav aria-label="Footer">
              <ul>
                {[...SECTIONS, { href: "/signin", label: "Sign in" }].map(({ href, label }) => (
                  <li key={href} className="border-b border-white/10 first:border-t">
                    <Link
                      href={href}
                      className="focus-ring group flex items-center justify-between gap-4 rounded py-3.5 transition-colors hover:text-primary-300"
                    >
                      <span className="font-poster text-[2rem] sm:text-[2.5rem]">{label}</span>
                      <ArrowUpRight
                        className="h-6 w-6 shrink-0 text-white/35 transition-[transform,color] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-300"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className={cn(wrap, "border-t border-white/10 py-5")}>
            <details className="group">
              <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-caption font-medium text-white/80 hover:text-white [&::-webkit-details-marker]:hidden">
                <Plus className="h-3.5 w-3.5 transition-transform group-open:rotate-45" aria-hidden />
                Photo credits
              </summary>
              <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-caption text-white/60 md:grid-cols-2">
                {PHOTO_LIST.map(({ title, place, credit }) => (
                  <li key={credit.source}>
                    <a href={credit.source} target="_blank" rel="noreferrer" className="text-white/85 underline-offset-2 hover:underline">
                      {title}
                    </a>{" "}
                    ({place}) by {credit.author},{" "}
                    {credit.licenseUrl ? (
                      <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                        {credit.license}
                      </a>
                    ) : (
                      credit.license
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-caption text-white/50">
                Photos above via Wikimedia Commons, resized and cropped for this page.
              </p>
            </details>
          </div>

          <div className={cn(wrap, "flex flex-col justify-between gap-2 border-t border-white/10 py-5 text-caption text-white/60 sm:flex-row")}>
            <span>© {new Date().getFullYear()} Gobi. Academic MVP.</span>
            <span>Built with Next.js, Express &amp; PostgreSQL.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
