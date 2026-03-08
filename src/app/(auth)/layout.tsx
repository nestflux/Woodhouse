import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-primary text-3xl font-bold">Woodhouse</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your AI recruiting agent
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
