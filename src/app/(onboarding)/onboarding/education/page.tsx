import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EducationForm } from "./education-form";

export default async function EducationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: education } = await supabase
    .from("education")
    .select("*")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true })
    .order("end_date", { ascending: false, nullsFirst: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_parsed_data")
    .eq("id", user.id)
    .single();

  const parsed = profile?.resume_parsed_data as Record<string, unknown> | null;

  return (
    <EducationForm
      initialEducation={education ?? []}
      hasParsedData={!!parsed}
      parsedEducation={
        (parsed?.education as Array<Record<string, unknown>>) ?? []
      }
    />
  );
}
