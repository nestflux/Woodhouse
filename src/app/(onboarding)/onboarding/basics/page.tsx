import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BasicsForm } from "./basics-form";

export default async function BasicsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, phone, country, location, linkedin_url, portfolio_url, github_url, resume_parsed_data"
    )
    .eq("id", user.id)
    .single();

  // Extract pre-fill data from parsed resume if available
  const parsed = profile?.resume_parsed_data as Record<string, unknown> | null;
  const defaults = {
    full_name: profile?.full_name || "",
    phone: profile?.phone || (parsed?.phone as string) || "",
    country: profile?.country || (parsed?.country as string) || "",
    location: profile?.location || (parsed?.location as string) || "",
    linkedin_url:
      profile?.linkedin_url || (parsed?.linkedin_url as string) || "",
    portfolio_url:
      profile?.portfolio_url || (parsed?.portfolio_url as string) || "",
    github_url: profile?.github_url || (parsed?.github_url as string) || "",
  };

  const hasParsedData = !!parsed;

  return <BasicsForm defaults={defaults} hasParsedData={hasParsedData} />;
}
