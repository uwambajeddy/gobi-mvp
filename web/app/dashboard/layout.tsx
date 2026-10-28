import { AppShell } from "@/components/layout/AppShell";
import { DriverTrackerProvider } from "@/components/driver/DriverBackgroundTracker";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // Streams the driver's position from "Going to pickup" until arrival; the
    // top bar and the trip card show its status.
    <DriverTrackerProvider>
      <AppShell>{children}</AppShell>
    </DriverTrackerProvider>
  );
}
