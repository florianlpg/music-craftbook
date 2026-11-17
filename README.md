<div align="center">

# 🎧 Music Craftbook

**All-in-one workspace for writing over beats**  
Search • Write • Record • Sync • Share

[![Next.js](https://img.shields.io/badge/Next.js-16-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

</div>

---

## 🚀 What is Music Craftbook?

Music Craftbook is a **creative workspace for artists working with YouTube beats**.

It removes friction from your workflow by combining:

- 🎵 Beat discovery
- ✍️ Lyrics writing
- 🎙️ Voice recording
- ⏱️ Beat-synced ideas
- 🔗 Sharing

All in one place — so you stay in flow.

---

## ⚡ The Problem

Most workflows look like this:

- YouTube → find beats
- Notes app → write lyrics
- Voice memos → record ideas
- Messages → share progress

👉 Result: **fragmented, slow, and messy**

---

## ✅ The Solution

Music Craftbook unifies everything into a single interface:

```text
Find beat → Save → Write → Record → Sync → Share
```

---

## 🖼 Preview

### 🔍 Discover beats

![Search results](./images/search_results.png)

### ⭐ Save and revisit

![Favorites](./images/favorites_tab.png)

### ✍️ Write + record in sync

![Timeline](./images/timeline_view.png)

---

## 🔥 Core Features

### 🎵 Beat Search & Download

- Search YouTube with smart filters (type beats, artists, recency)
- **YouTube Data API v3** — fast, reliable search powered by your own API key (free tier, set up in Settings)
- **Custom search tags** — build a personal library of keyword tags, toggle them on/off per search, rename or delete anytime (saved to your personal workspace)
- **Search history** — last 15 searches remembered, restore any with one click
- **Pagination** — browse more results with "Load more" (cursor-based, no artificial cap)
- **Search summary** — result count, active query, and filter badges above every result list
- **Video metadata** — each card shows uploader, view count, and upload date; one-click "Watch on YouTube"
- **Block videos** — "Never show again" on any result hides it permanently; manage blocked videos in a dedicated tab
- Paste any video URL to analyze
- Extract:
  - BPM
  - Key
  - Beat type
  - Artist references
- Preview instantly
- Download as MP3 / WAV / MP4

![Paste URL](./images/paste_url_download.png)

---

### ⭐ Favorites

- Save beats with full metadata
- Persist search filters
- Jump back into the same context instantly

![Favorites](./images/favorites_tab.png)

---

### ✍️ Notes & Lyrics Editor

- Mix text + voice blocks
- Auto-save
- Insert anywhere
- Clean writing interface

![Editor](./images/notes_editor_empty.png)

---

### 🎙️ Voice Recording

- Record directly inside the editor
- Instant playback
- Stored seamlessly

![Recording](./images/voice_recording.png)

---

### ⏱️ Beat-Synced Voice Notes (✨ Key Feature)

Capture ideas exactly where they belong in the beat.

- Pick a timestamp
- Preview before recording
- Optional −5s lead-in
- Record in sync with playback
- Replay with beat perfectly aligned

👉 This replaces messy voice memos completely

![Synced](./images/voice_note_added.png)

---

### 🧭 Timecodes & Song Structure

- Auto-detect timestamps from YouTube descriptions
- Interactive timeline
- Live playhead
- Section labels (Intro, Verse, Hook…)
- Auto-tag recordings

![Timeline](./images/timeline_view.png)

---

### 🎧 Audio Device Control & Recording Quality

- Select microphone input — enforced with `exact` device constraint, falls back gracefully if unavailable
- Route output to speakers / headphones
- Recording disables browser voice-call processing (echo cancellation, noise suppression, auto gain) that degrades music recording quality
- 48 kHz sample rate, stereo capture, 128 kbps Opus encoding

---

### ⚙️ Settings

- Optional **YouTube API key** for faster search and analysis (yt-dlp is used without a key)
- **Export your data** as JSON
- All features are available immediately in one personal workspace

---

### 🔗 Sharing (🚀 Standout Feature)

Turn notes into a **shareable experience**:

- Public note pages
- Listen + read in sync
- Send one clean link

Read-only links let others listen and read.

![Shared](./images/shared_note_view.png)

---

### 🚫 Blocked Videos

Keep your search results clean:

- Click "Never show again" on any search result
- The video is immediately hidden and saved to your personal workspace
- View and manage all blocked videos in the **Blocked** tab
- Unblock any video with one click

---

### 🗂️ Song Organization

Keep your sessions tidy with folders:

- Create freely-named folders in the Songs tab
- Move songs between folders with one click
- Rename or delete folders inline (songs are never lost)
- Unfiled songs always visible below your folders

---

## 🧱 Tech Stack

| Layer | Technology |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma |
| Access | Personal workspace, no sign-in |
| Search | yt-dlp · custom tags · history · pagination |
| YouTube | yt-dlp |
| Audio | ffmpeg |
| Infra | Docker Compose |

---

## 🛠 Getting Started

### Prerequisites

- Docker
- Node.js 22.12+ (Docker uses Node.js 22)

### Run with Docker

```bash
docker compose up --build
```

App runs at:
```
http://localhost:3000
```

---

### Run locally

```bash
npm install
# create .env.local with the variables listed below
npx prisma migrate deploy
npm run dev
```

---

## 🔐 Environment Variables

| Variable | Description |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public base URL (e.g. `http://localhost:3000`) |

> Set these in `.env.local` for the Next.js dev server and in `.env` for Prisma CLI commands.

---

## 🧠 Data Model

- **User** → owns notes + favorites + tags + blocked videos
- **Favorite** → beat + metadata
- **Note** → structured blocks (text + audio)
- **SearchTag** → per-user keyword tags for search
- **BannedVideo** → videos the user never wants to see in search

---

## 🤝 Contributing

PRs, ideas, and feedback welcome.

---

## ⭐ Support

If this project helps you, drop a star 🙌


### Personal workspace

The app opens without sign-in. All visitors can use the same favorites, songs, notes, tags, blocked videos, and YouTube key settings. Run this personal app on a private machine or trusted network.

On first use, existing accounts’ favorites, notes (including songs, folders, voice recordings and timecodes), tags, blocked videos, and the first saved YouTube key are imported into a fixed personal workspace in one transaction. Original content rows remain as a backup; public link IDs transfer to the imported notes. Duplicate favorites combine tags and artist lists; duplicate notes combine distinct blocks and timecodes, keeping the first nonempty metadata. Other account versions remain in the database. Import runs only once, so removing personal items does not bring old copies back after a restart. No schema migration is required. Google OAuth and session secrets are no longer needed.

Live collaboration, invite links, and the Socket.io server have been removed. Notes save through the normal notes API. Existing editToken columns are retained as unused legacy data; public read-only sharing remains available.

Run `npm test` to check fresh-workspace creation and cookie-free library access, note saves, and YouTube key settings with a mocked database.

Dependency maintenance: Next.js and its ESLint config are kept on the same version; React and React DOM are updated together. Prisma 7 uses `@prisma/adapter-pg`, generates its client into `src/generated/prisma`, and reads CLI settings from `prisma.config.ts`. `prisma generate` does not require a live database; migration commands require `DATABASE_URL`. TypeScript stays on the Prisma-recommended 5.9 line and Node types match the Node 22 container runtime.
