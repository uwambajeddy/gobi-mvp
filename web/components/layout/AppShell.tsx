"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const COLLAPSED_KEY = "gobi.sidebar.collapsed";

/** Authenticated application frame: sidebar, top bar and content area. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Remembered per browser; storage can be unavailable (private mode, etc.).
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* default to expanded */
    }
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      } catch {
        /* preference just won't persist */
      }
      return !value;
    });

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 text-label shadow-raised focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 p-3 pr-0 transition-[width] duration-200 lg:block",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        <div className="h-full overflow-hidden rounded-panel bg-ink shadow-raised">
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            aria-hidden
            className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[18rem] max-w-[85vw] animate-slide-in-left bg-ink shadow-overlay">
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-5 z-10 text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-offset-ink"
            >
              <X />
            </Button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content flex-1 px-4 pb-16 pt-2 focus:outline-none md:px-6 xl:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
