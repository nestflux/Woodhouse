import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const userName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "";
  const userEmail = user.email || "";

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar userEmail={userEmail} userName={userName} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      <Toaster />
    </div>
  );
}
