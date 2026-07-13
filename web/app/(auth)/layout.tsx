import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-light-base">
      <header className="container py-6">
        <Link href="/" className="text-2xl font-bold text-primary">
          Gobi
        </Link>
      </header>
      <div className="container flex flex-1 items-center justify-center pb-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
