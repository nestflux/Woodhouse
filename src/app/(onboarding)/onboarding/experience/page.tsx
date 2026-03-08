import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExperienceForm } from "./experience-form";

export default async function ExperiencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: experiences } = await supabase
    .from("work_experiences")
    .select("*, achievements(*)")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_parsed_data")
    .eq("id", user.id)
    .single();

  const parsed = profile?.resume_parsed_data as Record<string, unknown> | null;
  const hasParsedData = !!parsed;

  return (
    <ExperienceForm
      initialExperiences={experiences ?? []}
      hasParsedData={hasParsedData}
      parsedExperiences={
        (parsed?.work_experiences as Array<Record<string, unknown>>) ?? []
      }
    />
  );
}
