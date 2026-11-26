import { type NextRequest } from "next/server";
import { execFileAsync, getYtDlpPath, analyzeBeatInfo } from "@/app/lib/ytdlp";
import { getWorkspace } from "@/app/lib/workspace";
import { prisma } from "@/app/lib/prisma";
import { musicalKeySearchTerms, normalizeMusicalKey, type MusicalKey } from "@/app/lib/musical-key";
import {
  YT_API_BASE,
  parseIsoDuration,
  formatYtDuration,
  toUploadDate,
  parseYouTubeError,
} from "@/app/lib/youtube";

export const maxDuration = 60;

const PAGE_SIZE = 15;
const MAX_PAGE = 4; // yt-dlp only
const KEY_PAGE_SIZE = 20;
const KEY_BATCH_SIZE = 50;
const KEY_BATCH_LIMIT = 3;
const YTDLP_KEY_BATCH_SIZE = 12;
const YTDLP_KEY_MAX_PAGE = 42;

type SearchResult = ReturnType<typeof analyzeBeatInfo> & {
  id: string; url: string; duration: string; durationSec: number; thumbnail: string;
  viewCount: number | null; uploader: string | null; uploadDate: string | null;
};

interface SearchBatch {
  results: SearchResult[];
  nextPageToken: string | null;
}

function searchResponse({ results, nextPageToken }: SearchBatch) {
  persistToCache(results);
  return Response.json({ results, nextPageToken, hasMore: !!nextPageToken });
}

// A page of matches can end partway through a provider batch. Keep the cursor
// and the position in that batch so Load more resumes at the next candidate.
function keyCursor(pageToken: string | null) {
  if (pageToken === null) return { token: null, offset: 0 };
  const match = pageToken.match(/^key:(\d{1,2}):([\w=-]{0,512})$/);
  if (!match || Number(match[1]) >= KEY_BATCH_SIZE) {
    throw Response.json({ error: "Invalid search page" }, { status: 400 });
  }
  return { token: match[2] || null, offset: Number(match[1]) };
}

async function searchByKey(
  key: MusicalKey,
  pageToken: string | null,
  userId: string,
  fetchBatch: (token: string | null) => Promise<SearchBatch>,
): Promise<SearchBatch> {
  let { token, offset } = keyCursor(pageToken);
  const blocked = await prisma.bannedVideo.findMany({ where: { userId }, select: { videoId: true } });
  const seen = new Set(blocked.map(({ videoId }) => videoId));
  const results: SearchResult[] = [];
  for (let batch = 0; batch < KEY_BATCH_LIMIT; batch++) {
    let page: SearchBatch;
    try {
      page = await fetchBatch(token);
    } catch (error) {
      if (!results.length) throw error;
      // Keep matches already found if the provider fails on a later batch.
      return { results, nextPageToken: `key:${offset}:${token ?? ""}` };
    }
    for (; offset < page.results.length; offset++) {
      const result = page.results[offset];
      if (result.key !== key || seen.has(result.id)) continue;
      results.push(result);
      seen.add(result.id);
      if (results.length === KEY_PAGE_SIZE && offset + 1 < page.results.length) {
        return { results, nextPageToken: `key:${offset + 1}:${token ?? ""}` };
      }
      if (results.length === KEY_PAGE_SIZE) break;
    }
    if (!page.nextPageToken || page.nextPageToken === token) return { results, nextPageToken: null };
    token = page.nextPageToken;
    offset = 0;
    if (results.length === KEY_PAGE_SIZE) break;
  }
  return { results, nextPageToken: `key:0:${token}` };
}

// ── Date helpers ────────────────────────────────────────────────

/** YouTube API: RFC 3339 */
function computePublishedAfter(filter: string): string {
  const d = new Date();
  switch (filter) {
    case "year":    d.setFullYear(d.getFullYear() - 1); break;
    case "6months": d.setMonth(d.getMonth() - 6); break;
    case "1month":  d.setMonth(d.getMonth() - 1); break;
    case "2weeks":  d.setDate(d.getDate() - 14); break;
    case "1week":   d.setDate(d.getDate() - 7); break;
    case "1day":    d.setDate(d.getDate() - 1); break;
  }
  return d.toISOString();
}

/** yt-dlp: YYYYMMDD */
function computeDateAfter(filter: string): string {
  const d = new Date();
  switch (filter) {
    case "year":    d.setFullYear(d.getFullYear() - 1); break;
    case "6months": d.setMonth(d.getMonth() - 6); break;
    case "1month":  d.setMonth(d.getMonth() - 1); break;
    case "2weeks":  d.setDate(d.getDate() - 14); break;
    case "1week":   d.setDate(d.getDate() - 7); break;
    case "1day":    d.setDate(d.getDate() - 1); break;
  }
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Cache helper ────────────────────────────────────────────────

function persistToCache(results: {
  id: string; title: string; thumbnail: string; duration: string;
  durationSec: number; url: string; viewCount: number | null;
  uploader: string | null; uploadDate: string | null;
}[]) {
  void Promise.all(
    results.map((r) =>
      prisma.cachedVideo.upsert({
        where: { videoId: r.id },
        update: {
          title: r.title, thumbnail: r.thumbnail, duration: r.duration,
          durationSec: r.durationSec, url: r.url, viewCount: r.viewCount ?? null,
          uploader: r.uploader ?? null, uploadDate: r.uploadDate ?? null,
        },
        create: {
          videoId: r.id, title: r.title, thumbnail: r.thumbnail, duration: r.duration,
          durationSec: r.durationSec, url: r.url, viewCount: r.viewCount ?? null,
          uploader: r.uploader ?? null, uploadDate: r.uploadDate ?? null,
        },
      })
    )
  ).catch((error) => console.error("Failed to cache search results", error));
}

// ── Main handler ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const dateFilter = request.nextUrl.searchParams.get("dateFilter");
  const pageToken = request.nextUrl.searchParams.get("pageToken");
  const keyParam = request.nextUrl.searchParams.get("musicalKey");
  const musicalKey = keyParam === null ? null : normalizeMusicalKey(keyParam);

  if (!query?.trim()) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }
  if (keyParam !== null && !musicalKey) {
    return Response.json({ error: "Invalid musical key" }, { status: 400 });
  }

  try {
    const { id, youtubeApiKey } = await getWorkspace();
    const keywords = query.trim();
    const searchQuery = musicalKey
      ? musicalKeySearchTerms(musicalKey).map((term) => `${keywords} ${term}`).join("|")
      : keywords;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
    const fetchBatch = (token: string | null) => youtubeApiKey
      ? youtubeApiSearch(searchQuery, dateFilter, token, youtubeApiKey, musicalKey ? KEY_BATCH_SIZE : PAGE_SIZE, signal)
      : ytDlpSearch(searchQuery, dateFilter, token, !!musicalKey, signal);
    const page = musicalKey ? await searchByKey(musicalKey, pageToken, id, fetchBatch) : await fetchBatch(pageToken);
    return searchResponse(page);
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}

// ── Mode A: YouTube Data API v3 ─────────────────────────────────

async function youtubeApiSearch(
  query: string,
  dateFilter: string | null,
  pageToken: string | null,
  apiKey: string,
  batchSize: number,
  signal: AbortSignal,
): Promise<SearchBatch> {
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(batchSize),
    key: apiKey,
  });
  if (pageToken) searchParams.set("pageToken", pageToken);
  if (dateFilter) searchParams.set("publishedAfter", computePublishedAfter(dateFilter));

  const searchRes = await fetch(`${YT_API_BASE}/search?${searchParams}`, { signal });
  if (!searchRes.ok) {
    const body = await searchRes.json().catch(() => null);
    const err = parseYouTubeError(searchRes.status, body);
    throw Response.json({ error: err.message, code: err.code }, { status: err.httpStatus });
  }
  const searchData = await searchRes.json();

  type SearchItem = {
    id: { videoId: string };
    snippet: { thumbnails: { high?: { url: string }; medium?: { url: string } } };
  };
  const items: SearchItem[] = searchData.items ?? [];
  const nextPageToken: string | undefined = searchData.nextPageToken;

  if (items.length === 0) {
    return { results: [], nextPageToken: nextPageToken ?? null };
  }

  const videoIds = items.map((i) => i.id.videoId).join(",");
  const videosRes = await fetch(
    `${YT_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`,
    { signal },
  );
  if (!videosRes.ok) {
    const body = await videosRes.json().catch(() => null);
    const err = parseYouTubeError(videosRes.status, body);
    throw Response.json({ error: err.message, code: err.code }, { status: err.httpStatus });
  }
  const videosData = await videosRes.json();

  type VideoDetail = {
    id: string;
    snippet: { title: string; description: string; channelTitle: string; publishedAt: string };
    contentDetails: { duration: string };
    statistics: { viewCount?: string };
  };
  const videoMap = new Map<string, VideoDetail>();
  for (const v of (videosData.items ?? []) as VideoDetail[]) videoMap.set(v.id, v);

  const results = items
    .filter((i) => videoMap.has(i.id.videoId))
    .map((i) => {
      const v = videoMap.get(i.id.videoId)!;
      const durationSec = parseIsoDuration(v.contentDetails?.duration ?? "PT0S");
      const analysis = analyzeBeatInfo(v.snippet.title, v.snippet.description ?? "", "");
      return {
        id: i.id.videoId,
        url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
        duration: formatYtDuration(durationSec),
        durationSec,
        thumbnail:
          i.snippet.thumbnails.high?.url ??
          i.snippet.thumbnails.medium?.url ??
          `https://i.ytimg.com/vi/${i.id.videoId}/hqdefault.jpg`,
        viewCount: parseInt(v.statistics?.viewCount ?? "0", 10) || null,
        uploader: v.snippet.channelTitle || null,
        uploadDate: toUploadDate(v.snippet.publishedAt),
        ...analysis,
      };
    });

  return { results, nextPageToken: nextPageToken ?? null };
}

// ── Mode B: yt-dlp ──────────────────────────────────────────────
// pageToken is the page number encoded as a string ("1", "2", …)

async function ytDlpSearch(
  query: string,
  dateFilter: string | null,
  pageToken: string | null,
  filterByKey: boolean,
  signal: AbortSignal,
): Promise<SearchBatch> {
  const maxPage = filterByKey ? YTDLP_KEY_MAX_PAGE : MAX_PAGE;
  const batchSize = filterByKey ? YTDLP_KEY_BATCH_SIZE : PAGE_SIZE;
  const page = Math.min(maxPage, Math.max(1, parseInt(pageToken || "1", 10) || 1));
  const ytdlp = getYtDlpPath();
  const first = (page - 1) * batchSize + 1;
  const fetchCount = page * batchSize;

  const args = ["--dump-json", "--no-download", "--no-warnings"];
  const dateAfter = dateFilter ? computeDateAfter(dateFilter) : null;
  if (filterByKey) args.push("--playlist-items", `${first}:${fetchCount}`);
  if (filterByKey) args.push("--ignore-errors", "--ignore-no-formats-error", "--socket-timeout", "5", "--extractor-retries", "0");
  args.push("--no-playlist", `ytsearch${fetchCount}:${query}`);
  if (dateAfter && !filterByKey) args.push("--dateafter", dateAfter);

  const { stdout, stderr } = await execFileAsync(ytdlp, args, {
    timeout: 45000,
    maxBuffer: 50 * 1024 * 1024,
    signal,
  });

  const lines = stdout.trim().split("\n").filter(Boolean);
  const extractionFailed = filterByKey && stderr.includes("ERROR:");
  if (extractionFailed && lines.length === 0) throw new Error("Could not read video metadata");
  const allResults = lines.map((line) => {
    const data = JSON.parse(line);
    const id: string = data.id || "";
    const title: string = data.title || "Untitled";
    const description: string = data.description || "";
    const duration = data.duration || 0;
    const thumbnail: string = data.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const analysis = analyzeBeatInfo(title, description, "");
    return {
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      duration: formatDuration(Math.round(duration)),
      durationSec: Math.round(duration),
      thumbnail,
      viewCount: typeof data.view_count === "number" ? data.view_count : null,
      uploader: (data.uploader || data.channel || null) as string | null,
      uploadDate: (data.upload_date || null) as string | null,
      ...analysis,
    };
  });

  const pageResults = filterByKey
    ? allResults.filter((r) => (!dateAfter || (r.uploadDate && r.uploadDate >= dateAfter)))
    : allResults.slice(first - 1);
  const hasMore = page < maxPage && (extractionFailed || lines.length >= (filterByKey ? batchSize : fetchCount));
  const nextPageToken = hasMore ? String(page + 1) : null;

  return { results: pageResults, nextPageToken };
}
