# Next Starter Template

English | [简体中文](README.zh-CN.md)

A production-ready Next.js starter template with React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and Docker support.

## Features

- **Next.js 16** - Latest App Router with React Server Components
- **TypeScript** - Full type safety with strict mode
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **Framer Motion** - Smooth animations
- **Lucide Icons** - Beautiful icon library
- **Prisma** - Type-safe database ORM
- **Docker** - Containerized deployments
- **Rich Text Editor** - Tiptap-powered editor with preview modes
- **Internal Messages** - Admin-created messages with user inbox + read status
- **Pre-Application Appeals** - Rejected users can request super-admin review with cooldown + penalty rules
- **Fingerprint Tracking** - Browser fingerprint capture on login + pre-application submit with admin correlation tools
- **Theme & Locale** - Light/dark theme toggle + locale switcher
- **Multi-Platform** - Deploy to Vercel, Cloudflare, Netlify, Railway, Fly.io, and more

## Quick Start

```bash
# Clone the repository
npx create-next-app -e https://github.com/h7ml/next-starter next-starter

# Navigate to project
cd next-starter

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start development server
npm run dev
```

## Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Generate Prisma field type definitions (d.ts)
npm run prisma:types

# Push schema to database
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

Generated type definitions are written to `types/prisma.d.ts`.

## Internal Messages

- Admins can create and manage internal messages, targeting all users, by role, by status, or by specific user list.
- Users can read messages in `/{locale}/dashboard/messages`, with read/unread status tracking.
- The dashboard bell surfaces the latest message and links to the inbox.

## Pre-Application Appeals

- Rejected logged-in users can submit a pre-application appeal from `/{locale}/dashboard/pre-application`.
- Appeals are gated by a super-admin-controlled feature toggle, a 3-day per-application cooldown, and a single pending appeal invariant.
- Super admins review appeals in `/{locale}/admin/pre-application-appeals` and can either reject the appeal or restore the original pre-application to `PENDING`.
- Rejecting an appeal applies a 3-day submit ban by updating `User.preApplicationSubmitBannedUntil`.

## Fingerprint Tracking

- Login records browser fingerprint for password/code/OAuth flows.
- Dashboard pre-application submit records browser fingerprint.
- Admin pre-application review drawer shows fingerprint details plus related users/applications sharing the same fingerprint hash.
- Admin pre-application/user pages support fingerprint-hash search and CSV export includes fingerprint fields.
- Only hash is stored (no raw visitor ID in DB).
- Environment toggles: `FEATURE_FINGERPRINT`, `NEXT_PUBLIC_FEATURE_FINGERPRINT`, `FINGERPRINT_PEPPER`.

## Admin & Dashboard Features

- **Dashboard**: overview, posts management, analytics, settings, internal message inbox, pre-application appeal entry for rejected applications.
- **Admin**: user management, post moderation, analytics, settings, internal message management (create/edit/revoke), super-admin-only pre-application appeal review queue.
- **Auth**: session-based login, admin-only routes, role checks enforced on server.
- **Theme**: theme toggle available in header and dashboard.
- **Locale**: locale switcher in header and dashboard.

## Code Quality

```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint (ESLint + TSLint)
npm run lint

# Fix lint issues
npm run lint:fix

# Type check
npm run typecheck

# One-click fix then full checks
npm run fix:check
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build manually
docker build -t next-starter .
docker run -p 3000:3000 next-starter
```

## Project Structure

```
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   ├── docs/            # Documentation page
│   └── page.tsx         # Home page
├── components/          # React components
│   ├── layout/          # Layout components
│   ├── sections/        # Page sections
│   ├── providers/       # Context providers
│   └── ui/              # shadcn/ui components
├── lib/                 # Utilities
│   ├── db.ts           # Prisma client
│   ├── env.ts          # Environment validation
│   └── utils.ts        # Helper functions
├── types/               # Generated Prisma d.ts types
├── prisma/              # Database
│   └── schema.prisma   # Prisma schema
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose config
├── fly.toml            # Fly.io config
├── netlify.toml        # Netlify config
├── railway.yaml        # Railway config
└── vercel.json         # Vercel config
```

## Deploy

| Platform         | Guide                                   |
| ---------------- | --------------------------------------- |
| Vercel           | [Deploy](https://vercel.com/new)        |
| Cloudflare Pages | [Deploy](https://pages.cloudflare.com)  |
| Netlify          | [Deploy](https://app.netlify.com/start) |
| Railway          | [Deploy](https://railway.app/new)       |
| Fly.io           | `fly launch && fly deploy`              |
| Deno Deploy      | [Deploy](https://deno.com/deploy)       |

## License

MIT License - feel free to use this template for any project.
