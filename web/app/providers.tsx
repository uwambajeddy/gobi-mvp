"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { SocketProvider } from "@/context/SocketContext";

function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <SessionProvider refetchInterval={60}>
      <SocketProvider socketUrl={process.env.NEXT_PUBLIC_API_URL!}>
        <QueryClientProvider client={client}>
          {children}
          <Toaster
            position="top-right"
            gutter={10}
            toastOptions={{
              duration: 4000,
              className: "!rounded-inset !border !border-line/70 !px-3.5 !py-2.5 !text-body !text-ink !shadow-overlay",
              success: { iconTheme: { primary: "#10B981", secondary: "#FFFFFF" } },
              error: { duration: 6000, iconTheme: { primary: "#DC2626", secondary: "#FFFFFF" } },
            }}
          />
        </QueryClientProvider>
      </SocketProvider>
    </SessionProvider>
  );
}

export default Providers;
