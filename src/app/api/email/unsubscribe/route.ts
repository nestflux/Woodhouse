import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");

  if (!uid || !UUID_REGEX.test(uid)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ email_digest: "none" })
    .eq("id", uid);

  if (error) {
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }

  // Return a simple HTML confirmation page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Unsubscribed — Woodhouse</title>
<style>
body { font-family: 'Inter', system-ui, sans-serif; background: #fafaf9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
.card { background: #fff; border-radius: 12px; border: 1px solid #e7e5e4; padding: 48px; text-align: center; max-width: 400px; }
h1 { color: #1e3a5f; font-size: 24px; margin: 0 0 12px; }
p { color: #52525b; font-size: 14px; line-height: 1.6; margin: 0; }
.check { font-size: 48px; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="card">
<div class="check">&#10003;</div>
<h1>Unsubscribed</h1>
<p>You've been unsubscribed from Woodhouse email digests. You can re-enable them anytime in your account settings.</p>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
