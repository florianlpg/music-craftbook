import { getWorkspace } from "@/app/lib/workspace";

export async function GET() {
  const workspace = await getWorkspace();
  return Response.json({ hasYoutubeKey: !!workspace.youtubeApiKey });
}
