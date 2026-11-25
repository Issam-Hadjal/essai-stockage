# Essai stockage

## Purpose
A throwaway project to try the IndexedDB storage kit: a short list of notes kept in
this browser, with the backup buttons. A finished change makes one use work end to
end, in French.

## Stack
- Runtime: Node.js 26, the version of the CI and of Vercel, pinned in `.nvmrc`
  and in `package.json` (`"engines": { "node": "26.x" }`).
- Package manager: npm. `package-lock.json` is committed: install with `npm ci`,
  never `npm install`, which rewrites it. Adding, removing or upgrading a
  dependency is a change of its own, with its own issue.
- Next.js 16 (App Router, Turbopack, Cache Components), React 19, TypeScript in
  strict mode, Tailwind CSS 4, ESLint with `eslint-config-next`, Vitest with
  React Testing Library and jsdom, Playwright with axe for end-to-end and
  accessibility tests.
- Storage: IndexedDB through Dexie 4 and `dexie-react-hooks`, `fake-indexeddb` in
  the tests: see Storage.
- Fonts come from the `geist` package and ship with the page. Never
  `next/font/google`: it fetches from Google at build time.
- Next.js has changed since your training data. When `node_modules/` is
  installed, read the matching guide in `node_modules/next/dist/docs/` before
  writing Next.js code: it documents the installed version and reads offline.
  Heed its deprecation notices.

## Layout
| Path | What lives there |
|---|---|
| `app/` | the routes: one folder per segment, with `page.tsx`, `layout.tsx`, `route.ts` |
| `app/**/<feature>/` | a feature's routes, with the components only they use |
| `lib/<feature>/` | a feature's logic and its tests: pure functions, without React or browser APIs |
| `lib/` | helpers shared between features, flat |
| `components/` | React components shared between features |
| `e2e/` | end-to-end and accessibility tests, run by Playwright in a real browser |
| `public/` | static files, served as they are |

A feature folder is imported only by its own feature: by `lib/<feature>/` itself
and by the route folders named `<feature>` under `app/`. What two features need
moves up, flat, into `lib/`. `lib/architecture.test.ts` checks it: the CI fails
otherwise.

## Commands
From the repository root. The CI runs the same commands: a change is done when
they pass there.

| Step | Command |
|---|---|
| Install | `npm ci` |
| Build | `npm run build` — `next build`, which also checks the types and prerenders every page |
| Test | `npm test` — `vitest run`: once, without watching |
| Lint | `npm run lint` — `eslint`; `next lint` no longer exists, and `next build` no longer lints |
| End-to-end and accessibility | `npm run test:e2e` — Playwright, against the production build: run it after `npm run build`; it starts the server itself |
| Run locally | `npm run dev` — never needed to publish; stop it before you finish |

The CI installs, then builds. Tests and lint still run when the build fails, as
long as the install succeeded; the end-to-end and accessibility tests need a
successful build, and the CI installs their browser itself. `next build` also
type-checks test files: a test that does not compile breaks the build.

## Conventions
- A feature's logic lives in `lib/<feature>/` as pure functions, tested next to
  them: valid input, edge cases, invalid input. A page only wires them to the
  interface.
- The interface speaks French. Code, identifiers and file names are in English.
- In French JSX text, the apostrophe is the typographic one (’): the straight
  apostrophe makes the `react/no-unescaped-entities` rule fail.
- Server Components by default. `'use client'` only where state, effects or
  browser APIs are needed, as low in the tree as possible.
- Cache Components is on, so every page is prerendered at build time. Never
  read the clock or randomness during render, not even in a Client Component
  (`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`):
  otherwise `next build` fails. Read them in an event handler, or subscribe to
  them with `useSyncExternalStore`, whose server snapshot is a fixed value.
- Browser state — the clock, `localStorage`, `matchMedia` — reaches a component
  through `useSyncExternalStore`, never through a `useEffect` that sets state:
  the `react-hooks/set-state-in-effect` rule fails the lint. Such a hook lives
  next to the components that use it, never in `lib/<feature>/`, which stays
  free of React.
- Request APIs are asynchronous: `await` `params`, `searchParams`, `cookies()`,
  `headers()`.
- `proxy.ts`, not `middleware.ts`. Images through `next/image`.
- Tailwind is configured in CSS, in `app/globals.css`: there is no
  `tailwind.config.js`.
- A date field (`<input type="date">`) adds `appearance-none min-w-0
  [&::-webkit-date-and-time-value]:text-left` to the classes of the other
  fields: Safari on iPhone otherwise draws it wider than its column, and the
  whole page scrolls sideways. It keeps its type and its native picker.
- Imports from the repository root use the `@/` alias.
- Unit tests sit next to what they test: `<name>.test.ts(x)`. Vitest cannot
  render an async Server Component: test the functions it calls.
- Assertions use Vitest matchers: `@testing-library/jest-dom` is not installed,
  so neither `toHaveValue` nor `toBeInTheDocument` is available; read `.value`
  or `.textContent` instead.
- `vitest.config.mts` keeps `globals: true`: without it, Testing Library does
  not clean up the DOM between tests.
- Every page is listed in `e2e/accessibility.spec.ts`: the pull request that
  adds a route adds it there. Axe checks WCAG 2.1 A and AA, contrast included.
- `next.config.ts` keeps `agentRules: false`: this file, not `next dev`, says how
  to work here.

## Storage
IndexedDB, in this browser only, through Dexie 4: no server, no account, nothing
leaves the device. The browser may erase it (site data cleared; Safari after seven
days without a visit, unless the site is on the home screen), so the user keeps a
copy with the backup buttons.

- `lib/db.ts` declares the database, named after the project: its schema, the type
  of each table's rows, and the `Database` class. It is the only file that imports
  `dexie`. `lib/<feature>/` imports nothing from it but types
  (`import type { Note } from "@/lib/db"`): it shapes rows as pure functions.
- The schema is `VERSIONS` in `lib/db.ts`, one entry per version, oldest first. A
  change adds the next entry; an entry already on `main` is never edited or
  removed. `stores` lists the tables that change (`"++id, due"`: the primary key,
  then the indexed fields only; `null` deletes a table); `upgrade` rewrites the
  rows people already have when their shape changes, through the transaction it
  receives. A new table also gets its row type and a typed line in the `Database`
  class: `export type Note = { id: number; text: string; due: string };` and
  `declare notes: EntityTable<Note, "id">;`, with `EntityTable` imported from
  `dexie`.
- Every table has an inbound primary key (`id`, `++id`, `&code`, `[a+b]`), and rows
  hold JSON values only: strings, numbers, booleans, `null`, arrays and plain
  objects. A date is an ISO string, never a `Date`; no `Blob`, no `Map`. The backup
  is JSON: anything else would not come back. `lib/db.test.ts` checks the keys.
- Components read with `useLiveQuery` from `dexie-react-hooks`, as in
  `const notes = useLiveQuery(() => db.notes.orderBy("due").toArray(), []);`: the
  result is `undefined` while loading and in the prerender, and the component
  renders again at every change of the rows it read. They write in event handlers
  (`db.notes.add`, `put`, `update`, `delete`), never during a render, never through
  a `useEffect`, and never copy rows into a state.
- `components/backup-buttons.tsx` exports every table in one JSON file, and imports
  such a file back in place of the whole database, in one transaction, after a
  confirmation; a backup of an older version goes through the upgrades first. The
  request says where the buttons appear.
- Tests: `vitest.config.mts` gives every test file an in-memory IndexedDB
  (`fake-indexeddb`). A test that writes empties the tables it uses in
  `beforeEach`, or opens a `new Database("test-…", versions)` of its own and
  deletes it after.

## Verifying a change
- The home page shows the title and the list of notes, newest first.
- What the user saves is still there after a reload, and the backup gives it back:
  export, clear the site's data, import.
- `npm test` covers the logic of every feature: valid input, edge cases, invalid
  input.
- `npm run test:e2e` renders every page in a real browser and checks its
  accessibility.

## Do not touch
- Generated, never edited by hand, never committed: `.next/`, `node_modules/`,
  `next-env.d.ts`, `*.tsbuildinfo`, `test-results/`, `playwright-report/`.
- Never committed: any `.env*` file but `.env.example`; `.vercel/`.
- `package-lock.json` is written by npm only.

## Environment variables
None: the project reads no environment variable, and the build and the tests
need none. Adding one is a change of its own: its value would live in the
Vercel project, never in the repository, and `.env.example` would list its name
with an empty value.

## Deployment
Vercel. The branch `production` is the production deployment; every other
branch and every pull request gets a preview deployment. `production` moves only
when the owner merges `main` into it.
