import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeadlineForm } from "./headline-form";

export default async function HeadlinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("headline, summary, resume_parsed_data")
    .eq("id", user.id)
    .single();

  const parsed = profile?.resume_parsed_data as Record<string, unknown> | null;
  const defaults = {
    headline: profile?.headline || (parsed?.headline as string) || "",
    summary: profile?.summary || (parsed?.summary as string) || "",
  };

  const hasParsedData = !!parsed;

  return <HeadlineForm defaults={defaults} hasParsedData={hasParsedData} />;
}
