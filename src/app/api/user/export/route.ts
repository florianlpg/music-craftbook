import { prisma } from "@/app/lib/prisma";
import { getWorkspace } from "@/app/lib/workspace";

export async function GET() {
  const workspace = await getWorkspace();

  const user = await prisma.user.findUnique({
    where: { id: workspace.id },
    include: { favorites: true, notes: true, searchTags: true, bannedVideos: true },
  });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const exportData = {
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    favorites: user.favorites,
    notes: user.notes,
    tags: user.searchTags,
    blockedVideos: user.bannedVideos,
    exportedAt: new Date().toISOString(),
  };

  const date = new Date().toISOString().split("T")[0];
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="musiccraftbook-export-${date}.json"`,
    },
  });
}
