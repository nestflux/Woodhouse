import { notFound } from "next/navigation";
import { getUserResume } from "@/lib/actions/resume-builder";
import { checkSubscription } from "@/lib/subscription";
import { ResumeEditor } from "@/components/resume-builder/resume-editor";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResumeEditorPage({ params }: Props) {
  const { id } = await params;
  const result = await getUserResume(id);

  if (result.error || !result.data) {
    notFound();
  }

  // Use the profile_id from the loaded resume to check subscription
  // This avoids a second auth.getUser() call
  const subResult = await checkSubscription(result.data.profile_id);
  const isPaidPlan = subResult.data
    ? subResult.data.plan !== "free"
    : false;

  return <ResumeEditor resume={result.data} isPaidPlan={isPaidPlan} />;
}
