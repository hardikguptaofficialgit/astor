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

- **Monochrome Claude-Style Design**: Faithful black-and-white redesign inspired by Claude.ai: strict neutral black/white/grey palette across light (#FFFFFF, #F7F7F7, #F0F0F0, #E5E5E5, #0A0A0A) and dark (#0A0A0A, #141414, #1F1F1F, #1A1A1A, #262626, #F5F5F5) themes with zero warm beige or color tints (red used exclusively for Delete actions).
- **Brand Identity**: Custom hand-crafted SVG infinity ribbon mark (`AstorMark`) in `src/components/astor-mark.tsx`, rounded square favicon in `src/app/icon.svg`, and serif "Astor" wordmark.
- **Editorial Typography**: Elegant serif display typography (`Newsreader`, weights 400 & 500) for time-aware greetings, assistant markdown replies (16.5px, 1.65 line height), and wordmarks, paired with `Inter` for clean UI chrome and user speech bubbles.
- **Collapsible Sidebar (~288px)**: Smooth 200ms ease sliding sidebar with highlighted New Chat pill (shortcut `Ctrl+Shift+O`), Search command palette trigger (`Ctrl+K`), live-updating Recents list with rename and delete options, and upward account menu (Hardik) with theme selection (System/Light/Dark), keyboard shortcuts reference, and About modal. Hides completely when collapsed, leaving a top-left toggle icon. Responsive mobile drawer overlay.
- **Command Palette Search**: Fast modal search (`Ctrl+K`) backed by `GET /api/search?q=` using SQLite `LIKE` across both conversation titles and message content, with highlighted context snippets and keyboard navigation.
- **Streaming Chat & Actions**: Real-time response streaming with animated pulsing Astor mark before the first token, full markdown rendering (headings, tables with 1px borders, code blocks with language labels and copy buttons, blockquotes, underlined links), action row (Copy, Thumbs up/down, Retry, relative timestamps), and auto-growing composer with Web Search and Memory toggles.
- **Zero-Dependency Persistence**: Local SQLite database at `./data/astor.db` using Node.js built-in `node:sqlite` (`DatabaseSync`) in WAL mode with auto-titling and cascade deletions.
