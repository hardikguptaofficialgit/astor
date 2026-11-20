# Astor

Astor is a refined, monochrome AI chat assistant built with Next.js 15, Tailwind CSS, Vercel AI SDK, and Node.js built-in SQLite persistence (`node:sqlite`).

## Prerequisites

- **Node.js**: `>= 22.13.0` (uses native `DatabaseSync` from `node:sqlite`)
- **npm**: `>= 10.0.0`

## Quick Start

1. **Clone & install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `META_API_KEY`:
   ```env
   META_API_KEY=your_meta_api_key_here
   META_BASE_URL=https://api.meta.ai/v1
   ASTOR_MODEL=muse-spark-1.3
   ```
   > Note: If `META_API_KEY` is not provided, the app will still launch in preview mode and display a clear inline setup reminder when attempting to chat.

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Production Build & Linting**:
   ```bash
   npm run lint
   npm run build
   npm run start
   ```

## Architecture & Features

- **Monochrome Design**: Pixel-polished Claude.ai-style aesthetics with strict black/white/grey palette across light and dark modes, zero color accents, smooth 150-200ms micro-interactions, and no-flash theme persistence in `localStorage`.
- **Typography**: Editorial serif typography (`Newsreader`) for the greeting and assistant replies, paired with clean sans (`Inter`) for UI chrome.
- **Collapsible Sidebar**: ~260px left sidebar with smooth width transitions, grouped recents list (Today, Yesterday, Previous 7 days, Older), conversation renaming and deletion, responsive mobile overlay drawer, and dark/light/system theme toggle.
- **Streaming Chat**: Real-time response streaming powered by Vercel AI SDK (`streamText` + `toUIMessageStreamResponse`), animated initial-token shimmer, auto-growing bottom-pinned composer, markdown formatting with code block copy buttons, retry action, and scroll-to-bottom controls.
- **Zero-Dependency Persistence**: Local SQLite database located at `./data/astor.db` using Node 22's built-in `node:sqlite` (`DatabaseSync`), featuring WAL mode and auto-titling from the first user message.
