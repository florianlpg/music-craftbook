import { type NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getWorkspace } from "@/app/lib/workspace";

export async function GET() {
  const workspace = await getWorkspace();

  const favorites = await prisma.favorite.findMany({
    where: { userId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ favorites });
}

export async function POST(request: NextRequest) {
  const workspace = await getWorkspace();

  const body = await request.json();
  const {
    videoId, title, thumbnail, duration, durationSec, url,
    bpm, key, beatType, inspiredBy, tags,
    dateFilter, freeFilter, artistFilter, typeBeat,
  } = body;

  if (!videoId || !title || !url) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const favorite = await prisma.favorite.upsert({
    where: { userId_videoId: { userId: workspace.id, videoId } },
    create: {
      userId: workspace.id,
      videoId,
      title,
      thumbnail: thumbnail ?? "",
      duration: duration ?? "",
      durationSec: durationSec ?? 0,
      url,
      bpm: bpm ?? null,
      key: key ?? null,
      beatType: beatType ?? null,
      inspiredBy: inspiredBy ?? [],
      tags: tags ?? [],
      dateFilter: dateFilter ?? null,
      freeFilter: freeFilter ?? false,
      artistFilter: artistFilter ?? null,
      typeBeat: typeBeat ?? false,
    },
    update: {},
  });

  return Response.json({ favorite });
}

export async function PATCH(request: NextRequest) {
  const workspace = await getWorkspace();

  const { videoId, bpm, key, beatType, inspiredBy, tags } = await request.json();
  if (!videoId) {
    return Response.json({ error: "Missing videoId" }, { status: 400 });
  }

  const favorite = await prisma.favorite.update({
    where: { userId_videoId: { userId: workspace.id, videoId } },
    data: {
      bpm: bpm ?? null,
      key: key ?? null,
      beatType: beatType ?? null,
      inspiredBy: inspiredBy ?? [],
      tags: tags ?? [],
    },
  });

  return Response.json({ favorite });
}

export async function DELETE(request: NextRequest) {
  const workspace = await getWorkspace();

  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return Response.json({ error: "Missing videoId" }, { status: 400 });
  }

  await prisma.favorite.deleteMany({
    where: { userId: workspace.id, videoId },
  });

  return Response.json({ ok: true });
}
