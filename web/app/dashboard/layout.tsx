import SideBar from "@/components/sidebar/SideBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <SideBar />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
