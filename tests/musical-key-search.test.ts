import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/search/route";
import { extractMusicalKey, MUSICAL_KEYS, normalizeMusicalKey } from "../src/app/lib/musical-key";
import { prisma } from "../src/app/lib/prisma";
import { WORKSPACE_ID } from "../src/app/lib/workspace";

test("normalizes equivalent key spellings without confusing major and minor", () => {
  assert.equal(MUSICAL_KEYS.length, 24);
  for (const variant of ["Db min", "C♯ minor", "C sharp minor", "d♭m", "C#m"]) {
    assert.equal(normalizeMusicalKey(variant), "C# minor");
  }
  assert.equal(normalizeMusicalKey("D flat Maj"), "C# major");
  assert.equal(normalizeMusicalKey("Cb major"), "B major");
  assert.equal(normalizeMusicalKey("B# minor"), "C minor");
  assert.equal(normalizeMusicalKey("C#"), null);
  assert.equal(extractMusicalKey("Hip-hop instrumental", "Tempo: 140 BPM | Key: Db min"), "C# minor");
  assert.equal(extractMusicalKey("trap beat a minor"), "A minor");
  assert.equal(extractMusicalKey("Up at 7 AM", "I am making a minor update."), null);
});

test("key search fills the page from further batches and resumes inside a batch", async (t) => {
  const first = Array.from({ length: 20 }, (_, i) => `first-${i}`);
  const second = Array.from({ length: 22 }, (_, i) => `second-${i}`);
  const requestedPages: (string | null)[] = [];
  // Prisma delegates expose methods through a proxy, so replace them by assignment.
  function stub<T extends object, K extends keyof T>(target: T, key: K, implementation: () => Promise<unknown>) {
    const original = target[key];
    target[key] = implementation as T[K];
    t.after(() => { target[key] = original; });
  }
  stub(prisma.user, "findUnique", async () => ({ id: WORKSPACE_ID, youtubeApiKey: "test-key" }));
  stub(prisma.bannedVideo, "findMany", async () => [{ videoId: second[0] }]);
  stub(prisma.cachedVideo, "upsert", async () => ({}));
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/search")) {
      assert.equal(url.searchParams.get("q"), "trap beat C# minor|trap beat Db minor");
      assert.ok(url.searchParams.has("publishedAfter"));
      const token = url.searchParams.get("pageToken");
      requestedPages.push(token);
      const ids = token ? second : first;
      return Response.json({
        items: ids.map((videoId) => ({ id: { videoId }, snippet: { thumbnails: {} } })),
        nextPageToken: token ? undefined : "next",
      });
    }
    const ids = url.searchParams.get("id")!.split(",");
    return Response.json({
      items: ids.map((id) => ({
        id,
        snippet: {
          title: "Trap beat",
          description: first.slice(3).includes(id) ? "Key: C# major" : "Key: Db min",
          channelTitle: "Producer",
          publishedAt: "2026-09-01T00:00:00Z",
        },
      })),
    });
  });

  const params = new URLSearchParams({ q: "trap beat", musicalKey: "D♭ minor", dateFilter: "year" });
  const request = () => GET(new NextRequest(`http://localhost/api/search?${params}`));
  const response = await request();
  assert.equal(response.status, 200);
  const page = await response.json();
  assert.deepEqual(page.results.map(({ id }: { id: string }) => id), [...first.slice(0, 3), ...second.slice(1, 18)]);
  assert.ok(page.results.every(({ key }: { key: string }) => key === "C# minor"));
  assert.equal(page.hasMore, true);

  params.set("pageToken", page.nextPageToken);
  const continuation = await (await request()).json();
  assert.deepEqual(continuation.results.map(({ id }: { id: string }) => id), second.slice(18));
  assert.equal(continuation.hasMore, false);
  assert.deepEqual(requestedPages, [null, "next", "next"]);
});
