import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkillsForm } from "./skills-form";

export default async function SkillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .eq("profile_id", user.id)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_parsed_data")
    .eq("id", user.id)
    .single();

  const parsed = profile?.resume_parsed_data as Record<string, unknown> | null;

  return (
    <SkillsForm
      initialSkills={skills ?? []}
      hasParsedData={!!parsed}
      parsedSkills={
        (parsed?.skills as Array<Record<string, unknown>>) ?? []
      }
    />
  );
}
