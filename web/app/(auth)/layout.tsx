import { AuthShowcase } from "@/components/landing/AuthShowcase";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 gap-2 p-2 sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <AuthShowcase />

      {/* Form */}
      <div className="flex flex-col">
        <div className="flex flex-1 items-center justify-center px-2 py-5 sm:px-6 sm:py-8 lg:py-12">
          <div className="w-full max-w-[27rem]">{children}</div>
        </div>
        <p className="pb-2 text-center text-caption text-ink-muted">© {new Date().getFullYear()} Gobi. Academic MVP.</p>
      </div>
    </main>
  );
}
