import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const WORKSPACE_ID = "personal-workspace-v1";
const select = { id: true, youtubeApiKey: true } as const;

function omitFields<T extends object, K extends keyof T>(record: T, fields: K[]): Omit<T, K> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !fields.includes(key as K))) as Omit<T, K>;
}

// Keep both versions of a block if old accounts used the same block ID.
export function mergeNoteItems(current: Prisma.JsonValue, incoming: Prisma.JsonValue, sourceId: string): Prisma.InputJsonValue[] {
  const result = [...(Array.isArray(current) ? current : [])];
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (result.some((existing) => JSON.stringify(existing) === JSON.stringify(item))) continue;
    if (item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string") {
      const conflict = result.some((existing) => existing && typeof existing === "object" && !Array.isArray(existing) && existing.id === item.id);
      result.push(conflict ? { ...item, id: `${sourceId}:${item.id}` } : item);
    } else {
      result.push(item);
    }
  }
  return result as Prisma.InputJsonValue[];
}

export async function getWorkspace() {
  const existing = await prisma.user.findUnique({ where: { id: WORKSPACE_ID }, select });
  if (existing) return existing;

  // The workspace row is also the completion marker. It is committed only after
  // every import succeeds, so a restart cannot reimport deleted personal data.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(734820160)`;
    const ready = await tx.user.findUnique({ where: { id: WORKSPACE_ID }, select });
    if (ready) return ready;

    const sources = await tx.user.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const workspace = await tx.user.create({
      data: {
        id: WORKSPACE_ID,
        email: "personal-workspace-v1@musiccraftbook.local",
        youtubeApiKey: sources.find((source) => source.youtubeApiKey)?.youtubeApiKey ?? null,
      },
      select,
    });

    for (const source of sources) {
      for (const favorite of await tx.favorite.findMany({ where: { userId: source.id } })) {
        const data = omitFields(favorite, ["id", "userId"]);
        const where = { userId_videoId: { userId: WORKSPACE_ID, videoId: favorite.videoId } };
        const previous = await tx.favorite.findUnique({ where });
        if (!previous) {
          await tx.favorite.create({ data: { ...data, userId: WORKSPACE_ID } });
        } else {
          await tx.favorite.update({ where, data: {
            tags: [...new Set([...previous.tags, ...favorite.tags])],
            inspiredBy: [...new Set([...previous.inspiredBy, ...favorite.inspiredBy])],
            bpm: previous.bpm || favorite.bpm,
            key: previous.key || favorite.key,
            beatType: previous.beatType || favorite.beatType,
          } });
        }
      }
      for (const note of await tx.note.findMany({ where: { userId: source.id } })) {
        const { publicId } = note;
        const data = omitFields(note, ["id", "userId", "publicId", "editToken"]);
        const where = { userId_videoId: { userId: WORKSPACE_ID, videoId: note.videoId } };
        const previous = await tx.note.findUnique({ where });
        if (!previous) {
          // Public IDs are globally unique. Keep existing public links attached to
          // the imported editable note while retaining the original content row.
          if (publicId) await tx.note.update({ where: { id: note.id }, data: { publicId: null, isPublic: false } });
          await tx.note.create({ data: {
            ...data, userId: WORKSPACE_ID, publicId,
            blocks: note.blocks as Prisma.InputJsonValue,
            timecodes: note.timecodes as Prisma.InputJsonValue,
          } });
        } else {
          await tx.note.update({ where, data: {
            blocks: mergeNoteItems(previous.blocks, note.blocks, note.id),
            timecodes: mergeNoteItems(previous.timecodes, note.timecodes, note.id),
            songName: previous.songName || note.songName,
            folder: previous.folder || note.folder,
            bpm: previous.bpm || note.bpm,
            key: previous.key || note.key,
            beatType: previous.beatType || note.beatType,
            videoTitle: previous.videoTitle || note.videoTitle,
            videoThumbnail: previous.videoThumbnail || note.videoThumbnail,
            videoUrl: previous.videoUrl || note.videoUrl,
          } });
        }
      }
      for (const tag of await tx.searchTag.findMany({ where: { userId: source.id } })) {
        await tx.searchTag.upsert({
          where: { userId_name: { userId: WORKSPACE_ID, name: tag.name } },
          create: { userId: WORKSPACE_ID, name: tag.name, createdAt: tag.createdAt }, update: {},
        });
      }
      for (const blocked of await tx.bannedVideo.findMany({ where: { userId: source.id } })) {
        const data = omitFields(blocked, ["id", "userId"]);
        await tx.bannedVideo.upsert({
          where: { userId_videoId: { userId: WORKSPACE_ID, videoId: blocked.videoId } },
          create: { ...data, userId: WORKSPACE_ID }, update: {},
        });
      }
    }
    return workspace;
  }, { timeout: 120_000 });
}
