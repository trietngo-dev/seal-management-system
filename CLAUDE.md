# SEAL Hackathon Project Developer Guide

## Build & Run Commands
- **Server (Backend)**:
  - Install dependencies: `cd server && npm install`
  - Run development server: `cd server && npm start` (or `node ./bin/www`)
- **Client (Frontend Web)**:
  - Install dependencies: `cd client && npm install`
  - Run development server: `cd client && npm run dev`

## Code Style & Architecture
- **Backend (NodeJS/Express/MongoDB)**:
  - Use Mongoose for database schemas.
  - Follow the 20 models defined in `docs/database/schema.dbml`.
  - Use modular route files in `/routes` and service classes in `/services`.
  - Handle asynchronous tasks like GitHub repository creation and AI commit analysis using node-cron.
- **Frontend (ReactJS/TypeScript/TailwindCSS v4)**:
  - Use TailwindCSS v4 for styling (via `@tailwindcss/vite`; there is no `tailwind.config.js`).
  - Theme tokens live in the `@theme` block of `client/src/index.css`. Use `primary` (orange) for main actions and `secondary` (navy) for secondary actions; orange buttons, links and active nav items use `primary` with `hover:*-primary-hover` (same orange as the "Hỗ trợ" support button).
  - Use React Router for navigation.
  - Keep components modular, typing all props and states.
  - Implement dynamic Glassmorphism layouts.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **seal-management-system** (2638 symbols, 5256 relationships, 151 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/seal-management-system/context` | Codebase overview, check index freshness |
| `gitnexus://repo/seal-management-system/clusters` | All functional areas |
| `gitnexus://repo/seal-management-system/processes` | All execution flows |
| `gitnexus://repo/seal-management-system/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
