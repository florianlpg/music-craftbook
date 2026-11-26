import { prisma } from "@/app/lib/prisma";
import { getWorkspace } from "@/app/lib/workspace";
import { formatYtDuration } from "@/app/lib/youtube";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function timestamp(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? formatYtDuration(Math.floor(value))
    : "";
}

export async function GET(_request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const workspace = await getWorkspace();
  const where = { userId_videoId: { userId: workspace.id, videoId } };
  const [note, favorite] = await Promise.all([
    prisma.note.findUnique({
      where,
      select: {
        songName: true, folder: true, bpm: true, key: true, beatType: true,
        videoTitle: true, videoUrl: true, blocks: true, timecodes: true,
      },
    }),
    prisma.favorite.findUnique({
      where,
      select: { title: true, url: true, bpm: true, key: true, beatType: true, inspiredBy: true, tags: true },
    }),
  ]);

  if (!note?.songName) {
    return Response.json({ error: "Song not found" }, { status: 404 });
  }

  const fields = [
    ["Beat", favorite?.title || note.videoTitle],
    ["YouTube", favorite?.url || note.videoUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`],
    ["BPM", note.bpm || favorite?.bpm],
    ["Key", note.key || favorite?.key],
    ["Style", note.beatType || favorite?.beatType],
    ["Inspired by", favorite?.inspiredBy.join(", ")],
    ["Tags", favorite?.tags.join(", ")],
    ["Folder", note.folder],
  ].flatMap(([label, value]) => stringValue(value) ? [`${label}: ${stringValue(value)}`] : []);

  const timecodes = (Array.isArray(note.timecodes) ? note.timecodes : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const time = entry.time;
    if (typeof time !== "number" || !Number.isFinite(time) || time < 0) return [];
    const label = stringValue(entry.label);
    return [{ time, line: label ? `${timestamp(time)}  ${label}` : timestamp(time) }];
  }).sort((a, b) => a.time - b.time);

  const content = (Array.isArray(note.blocks) ? note.blocks : []).flatMap((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return [];
    if (block.type === "text" && typeof block.content === "string" && block.content.trim()) {
      return [block.content];
    }
    if (block.type !== "voice") return [];

    const beatTime = timestamp(block.beatTimecode);
    const duration = timestamp(block.duration);
    const details = [
      stringValue(block.sectionTag),
      beatTime && `at ${beatTime}`,
      duration && `${duration} long`,
    ].filter(Boolean);
    return [`[${["Voice note", ...details].join(" · ")}]`];
  });

  const sections = [note.songName.trim() || "Untitled song", fields.join("\n")];
  if (timecodes.length) sections.push(["Beat sections", ...timecodes.map(({ line }) => line)].join("\n"));
  if (content.length) sections.push(`Song content\n\n${content.join("\n\n")}`);

  return Response.json(
    { text: sections.join("\n\n").replace(/\r\n?/g, "\n") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
