import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PreferencesForm } from "./preferences-form";

export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "target_roles, target_locations, target_countries, remote_preference, min_salary, max_salary, salary_currency, match_threshold, country"
    )
    .eq("id", user.id)
    .single();

  const { data: prefs } = await supabase
    .from("search_preferences")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  return (
    <PreferencesForm
      profile={profile}
      searchPreferences={prefs}
    />
  );
}
