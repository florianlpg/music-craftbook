import { type NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getWorkspace } from "@/app/lib/workspace";

export async function GET() {
  const workspace = await getWorkspace();

  const banned = await prisma.bannedVideo.findMany({
    where: { userId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: { videoId: true, title: true, thumbnail: true, uploader: true, url: true, createdAt: true },
  });

  return Response.json({ banned });
}

// POST — ban a video { videoId, title, thumbnail, uploader?, url }
export async function POST(req: Request) {
  const workspace = await getWorkspace();

  const { videoId, title, thumbnail, uploader, url } = await req.json() as {
    videoId: string; title: string; thumbnail: string; uploader?: string; url: string;
  };

  if (!videoId?.trim() || !title?.trim() || !url?.trim()) {
    return Response.json({ error: "videoId, title and url are required" }, { status: 400 });
  }

  try {
    await prisma.bannedVideo.create({
      data: { userId: workspace.id, videoId, title, thumbnail, uploader: uploader ?? null, url },
    });
  } catch {
    // Already banned — treat as success
  }

  return Response.json({ ok: true });
}

// DELETE — unban a video ?videoId=xxx
export async function DELETE(req: NextRequest) {
  const workspace = await getWorkspace();

  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return Response.json({ error: "videoId is required" }, { status: 400 });
  }

  await prisma.bannedVideo.deleteMany({
    where: { userId: workspace.id, videoId },
  });

  return Response.json({ ok: true });
}
