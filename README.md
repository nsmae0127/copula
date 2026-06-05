# Copula

Copula is a mobile-first relationship hub for small private groups.

It brings together the things a close group usually scatters across chats, calendars, albums, and reminders: announcements, schedules, photos, short daily videos, shared commitments, and group-only messages.

## What Copula Does

- Create or join private copulas with invite codes.
- Switch between multiple copulas from the main Copula screen.
- Share announcements, schedules, D-Day items, albums, and 1s Vlog clips.
- Browse a simple activity feed that mixes recent notices, messages, schedules, albums, and tasks.
- Chat with members inside a copula and react to messages.
- Track relationship-scoped commitments for individuals, pairs, and circles.
- Use a mobile-friendly bottom action menu for quick posting.

## Product Direction

Copula is designed for family, friends, travel groups, clubs, and small communities that need a warmer shared space than a generic productivity tool.

The interface aims to feel:

- cute and personal
- easy to scan on mobile
- private by default
- focused on shared memories and lightweight coordination

## Tech Stack

- React
- TypeScript
- Vite
- Supabase integration layer
- PWA manifest and service worker

## Local Development

```sh
cd web
npm install
npm run dev
```

Open `http://localhost:4173`.

The app can run with local demo data for development. Runtime environment files are intentionally not included in this repository.

## Source Structure

- `web/src`: application source
- `web/src/screens`: main app screens
- `web/src/components`: shared UI and layout components
- `web/src/repositories`: local and Supabase data boundaries
- `web/public`: public PWA assets
- `supabase/migrations`: database migration files
- `supabase/functions`: Supabase Edge Function source

## Privacy Note

This repository does not include local environment files, private keys, production tokens, user data, or deployment credentials.
