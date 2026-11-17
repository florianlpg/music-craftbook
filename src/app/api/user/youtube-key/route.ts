import { getWorkspace } from "@/app/lib/workspace";
import { prisma } from "@/app/lib/prisma";

export async function PATCH(req: Request) {
  const workspace = await getWorkspace();

  const { apiKey } = await req.json() as { apiKey: string };
  const value = typeof apiKey === "string" ? apiKey.trim() || null : null;

  await prisma.user.update({
    where: { id: workspace.id },
    data: { youtubeApiKey: value },
  });

  return Response.json({ ok: true });
}
