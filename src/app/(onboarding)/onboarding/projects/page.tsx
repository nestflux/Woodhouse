import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectsForm } from "./projects-form";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true });

  const { data: certifications } = await supabase
    .from("certifications")
    .select("*")
    .eq("profile_id", user.id)
    .order("issue_date", { ascending: false, nullsFirst: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_parsed_data")
    .eq("id", user.id)
    .single();

  const parsed = profile?.resume_parsed_data as Record<string, unknown> | null;

  return (
    <ProjectsForm
      initialProjects={projects ?? []}
      initialCertifications={certifications ?? []}
      hasParsedData={!!parsed}
      parsedProjects={
        (parsed?.projects as Array<Record<string, unknown>>) ?? []
      }
      parsedCertifications={
        (parsed?.certifications as Array<Record<string, unknown>>) ?? []
      }
    />
  );
}
