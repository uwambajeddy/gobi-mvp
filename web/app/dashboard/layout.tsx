import { AppShell } from "@/components/layout/AppShell";
import { DriverTrackerProvider } from "@/components/driver/DriverBackgroundTracker";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverTrackerProvider>
      <AppShell>{children}</AppShell>
    </DriverTrackerProvider>
  );
}
