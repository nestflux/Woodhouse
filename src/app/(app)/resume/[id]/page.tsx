import { notFound } from "next/navigation";
import { getUserResume } from "@/lib/actions/resume-builder";
import { checkSubscription } from "@/lib/subscription";
import { ResumeEditor } from "@/components/resume-builder/resume-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResumeEditorPage({ params }: Props) {
  const { id } = await params;
  const [result, subResult] = await Promise.all([
    getUserResume(id),
    checkSubscription(),
  ]);

  if (result.error || !result.data) {
    notFound();
  }

  const isPaidPlan = subResult.data
    ? subResult.data.plan !== "free"
    : false;

  return <ResumeEditor resume={result.data} isPaidPlan={isPaidPlan} />;
}
