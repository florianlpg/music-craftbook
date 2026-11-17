import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "../src/app/lib/prisma";
import { getWorkspace, mergeNoteItems, WORKSPACE_ID } from "../src/app/lib/workspace";
import { GET as getFavorites } from "../src/app/api/favorites/route";
import { GET as getNotes, PUT as saveNote } from "../src/app/api/notes/[videoId]/route";
import { GET as getSettings } from "../src/app/api/workspace/route";
import { PATCH as saveKey } from "../src/app/api/user/youtube-key/route";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, implementation: (...args: unknown[]) => unknown) {
  const original = target[key];
  const fn = mock.fn(implementation);
  target[key] = fn as T[K];
  restores.push(() => { target[key] = original; });
  return fn;
}
function restore() { restores.splice(0).reverse().forEach((reset) => reset()); }

test("personal workspace opens existing data and saves notes/settings without cookies", async () => {
  const owner = { id: WORKSPACE_ID, youtubeApiKey: "secret-key" };
  stub(prisma.user, "findUnique", async () => owner);
  const favorites = stub(prisma.favorite, "findMany", async () => [{ videoId: "beat" }]);
  stub(prisma.favorite, "findUnique", async () => null);
  stub(prisma.note, "findUnique", async () => ({ videoId: "beat", blocks: [] }));
  const notes = stub(prisma.note, "upsert", async () => ({ videoId: "beat" }));
  const settings = stub(prisma.user, "update", async () => owner);
  try {
    assert.equal((await getWorkspace()).id, owner.id);
    assert.deepEqual(await (await getFavorites()).json(), { favorites: [{ videoId: "beat" }] });
    assert.deepEqual((favorites.mock.calls[0].arguments[0] as { where: unknown }).where, { userId: owner.id });
    const context = { params: Promise.resolve({ videoId: "beat" }) };
    assert.equal((await getNotes(new NextRequest("http://localhost/api/notes/beat"), context)).status, 200);
    const blocks = [{ id: "line", type: "text", content: "My lyrics" }];
    assert.equal((await saveNote(new NextRequest("http://localhost/api/notes/beat?collab=old-link", {
      method: "PUT", body: JSON.stringify({ blocks, songName: "My song" }),
    }), context)).status, 200);
    assert.deepEqual((notes.mock.calls[0].arguments[0] as { create: { blocks: unknown } }).create.blocks, blocks);
    assert.equal((notes.mock.calls[0].arguments[0] as { create: { userId: string } }).create.userId, owner.id);
    assert.deepEqual(await (await getSettings()).json(), { hasYoutubeKey: true });
    assert.equal((await saveKey(new Request("http://localhost/api/user/youtube-key", {
      method: "PATCH", body: JSON.stringify({ apiKey: " new-key " }),
    }))).status, 200);
    assert.deepEqual(settings.mock.calls[0].arguments[0], {
      where: { id: owner.id }, data: { youtubeApiKey: "new-key" },
    });
  } finally { restore(); }
});

test("first use imports legacy libraries once and preserves song/audio data", async () => {
  let workspace: { id: string; youtubeApiKey: string } | null = null;
  stub(prisma.user, "findUnique", async () => workspace);
  stub(prisma.user, "findMany", async () => [{ id: "old-owner", youtubeApiKey: "saved-key" }]);
  const createWorkspace = stub(prisma.user, "create", async () => {
    workspace = { id: WORKSPACE_ID, youtubeApiKey: "saved-key" };
    return workspace;
  });
  stub(prisma, "$executeRaw", async () => 1);
  stub(prisma, "$transaction", async (...args) => {
    const callback = args[0] as (tx: typeof prisma) => Promise<unknown>;
    return callback(prisma);
  });
  const blocks = [{ id: "voice", type: "voice", audioBase64: "recording", beatTimecode: 12 }];
  const timecodes = [{ id: "intro", time: 0, label: "Intro" }];
  stub(prisma.favorite, "findMany", async () => [{ id: "fav", userId: "old-owner", videoId: "beat", tags: ["rap"], inspiredBy: [] }]);
  stub(prisma.favorite, "findUnique", async () => null);
  const favorites = stub(prisma.favorite, "create", async () => ({}));
  stub(prisma.note, "findMany", async () => [{ id: "note", userId: "old-owner", videoId: "beat", blocks, timecodes, songName: "My song", folder: "Album", publicId: "shared", editToken: "old-invite" }]);
  stub(prisma.note, "findUnique", async () => null);
  const originalNote = stub(prisma.note, "update", async () => ({}));
  const notes = stub(prisma.note, "create", async () => ({}));
  stub(prisma.searchTag, "findMany", async () => [{ name: "rap", createdAt: new Date(0) }]);
  const tags = stub(prisma.searchTag, "upsert", async () => ({}));
  stub(prisma.bannedVideo, "findMany", async () => [{ id: "ban", userId: "old-owner", videoId: "blocked" }]);
  const blocked = stub(prisma.bannedVideo, "upsert", async () => ({}));
  try {
    assert.equal((await getWorkspace()).id, WORKSPACE_ID);
    assert.equal((await getWorkspace()).id, WORKSPACE_ID);
    assert.equal(createWorkspace.mock.calls.length, 1);
    assert.equal(favorites.mock.calls.length, 1);
    assert.deepEqual(notes.mock.calls[0].arguments[0], { data: {
      userId: WORKSPACE_ID, videoId: "beat", blocks, timecodes,
      songName: "My song", folder: "Album", publicId: "shared",
    } });
    assert.deepEqual(originalNote.mock.calls[0].arguments[0], {
      where: { id: "note" }, data: { publicId: null, isPublic: false },
    });
    assert.equal(tags.mock.calls.length, 1);
    assert.equal(blocked.mock.calls.length, 1);
  } finally { restore(); }
});

test("duplicate beat notes retain distinct lyrics, recordings, and timecodes", () => {
  const current = [{ id: "line", type: "text", content: "First song" }];
  const incoming = [current[0], { id: "line", type: "text", content: "Other lyrics" }, { id: "take", type: "voice", audioBase64: "audio" }];
  assert.deepEqual(mergeNoteItems(current, incoming, "source-note"), [
    current[0], { id: "source-note:line", type: "text", content: "Other lyrics" }, incoming[2],
  ]);
  assert.deepEqual(mergeNoteItems([], [{ id: "section", time: 12, label: "Verse" }], "source"), [{ id: "section", time: 12, label: "Verse" }]);
});
