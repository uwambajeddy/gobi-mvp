import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ClipboardCheck,
  FileCheck,
  Globe,
  ScrollText,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PILLARS = [
  {
    icon: Timer,
    title: "One operational timeline",
    description:
      "Every milestone (pickup, border crossed, customs released, POD) becomes structured data: who, when, where, evidence.",
  },
  {
    icon: FileCheck,
    title: "Document control",
    description:
      "A required-documents checklist per shipment with upload, verification and rejection. Nothing moves until the checklist is green.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance gates",
    description:
      "Dispatch is blocked on expired licences, insurance, inspections or overloads, and can only be overridden with an audited justification.",
  },
  {
    icon: Globe,
    title: "Cross-border visibility",
    description:
      "Border, customs and warehouse milestones recorded as they happen, shared with every shipment party.",
  },
  {
    icon: ScrollText,
    title: "Full auditability",
    description:
      "Every action is immutably logged with actor, role, organization and evidence. Nothing important lives only in WhatsApp.",
  },
  {
    icon: ClipboardCheck,
    title: "Manual-first, integration-ready",
    description:
      "Coordinators record events by hand today. GPS, customs and payment integrations automate the same events tomorrow.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Create & award",
    description:
      "The shipper creates the shipment with packages and route, assigns a carrier and clearing agent, and approves the quote.",
  },
  {
    step: "02",
    title: "Documents & gates",
    description:
      "Parties upload against the required checklist. The coordinator verifies each document; the compliance gate checks driver and vehicle before dispatch.",
  },
  {
    step: "03",
    title: "Execute & record",
    description:
      "The corridor journey is recorded milestone by milestone (checkpoints, borders, customs, warehouse) down to POD and closure.",
  },
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="container flex items-center justify-between py-4">
          <span className="text-2xl font-bold text-primary">Gobi</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 text-center md:py-28">
        <p className="mx-auto mb-4 inline-block rounded-full bg-primary-50 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700">
          Operational shipment coordination
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-dark md:text-6xl">
          One operational record for <span className="text-primary">every shipment</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-mute">
          Gobi is the coordination workspace for logistics companies managing domestic and
          cross-border freight, with shippers, carriers, clearing agents and drivers working from one
          timeline, one document checklist and one audit trail.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/signup">Set up your workspace</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Pillars */}
      <section className="bg-light-base py-20">
        <div className="container">
          <h2 className="text-center text-3xl font-bold text-dark">
            Visibility before automation
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-mute">
            The problem isn&apos;t the lack of GPS. It&apos;s the lack of operational
            visibility. Gobi structures the coordination work that lives in phone calls and
            spreadsheets today.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardContent className="p-6">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-dark">{title}</h3>
                  <p className="mt-2 text-sm text-mute">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <h2 className="text-center text-3xl font-bold text-dark">The shipment lifecycle</h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map(({ step, title, description }) => (
            <div key={step}>
              <p className="font-mono text-sm font-bold text-primary">{step}</p>
              <h3 className="mt-2 text-lg font-semibold text-dark">{title}</h3>
              <p className="mt-2 text-sm text-mute">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-dark py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-bold text-white">
            Stop coordinating shipments over WhatsApp
          </h2>
          <p className="mt-3 text-gray-300">
            Give every shipment one lifecycle, one timeline and one audit trail.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/signup">Create your workspace</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-sm text-mute md:flex-row">
          <span>© {new Date().getFullYear()} Gobi. Academic MVP.</span>
          <span>Built with Next.js, Express & PostgreSQL.</span>
        </div>
      </footer>
    </main>
  );
}
