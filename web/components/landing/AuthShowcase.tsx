"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { HeroRain } from "@/components/landing/HeroRain";
import { HERO_PHOTO } from "@/components/landing/photos";

/**
 * Photo panel beside the sign-in and sign-up forms, with the landing hero's
 * stormy photo and rain. Shows as a short banner above the form on small
 * screens. It lives in the auth layout, so the rain carries on between pages.
 */
export function AuthShowcase() {
  const isSignup = usePathname() === "/signup";

  return (
    <aside className="relative isolate flex min-h-[13rem] flex-col overflow-hidden rounded-[1.5rem] bg-ink sm:rounded-[2rem] lg:sticky lg:top-3 lg:h-[calc(100svh-1.5rem)] lg:min-h-[34rem] lg:self-start">
      <Image
        src={HERO_PHOTO.src}
        alt={HERO_PHOTO.alt}
        fill
        priority
        placeholder="blur"
        sizes="(min-width: 1025px) 55vw, 100vw"
        className="-z-10 object-cover object-[75%_center]"
      />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b from-ink/55 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[45%] bg-gradient-to-t from-ink/50 to-transparent" />
      <HeroRain />

      <header className="flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link href="/" aria-label="Gobi home" className="focus-ring rounded-control">
          <Logo inverse />
        </Link>
        <Link
          href="/"
          className="glass-dark focus-ring inline-flex h-control-sm items-center gap-1.5 rounded-control px-3.5 text-label text-white transition-colors hover:bg-ink/60"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
      </header>

      {/* Headline on a frosted plate; its radius is the panel's minus the inset. */}
      <div className="mt-auto p-3 sm:p-4">
        <div className="glass-dark rounded-[0.75rem] p-5 sm:rounded-[1rem] sm:p-7 xl:p-8">
          <p className="font-poster text-[2.375rem] text-white sm:text-[3.5rem] xl:text-[4.5rem]">
            {isSignup ? "Put every shipment" : "Every shipment,"}
            <span className="block text-primary-400">{isSignup ? "on one record." : "where you left it."}</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
