# AGENTS.md

## 1. Purpose
This repository contains a browser extension that saves page scroll positions so users can return to marked reading points later. The popup (`src/index.tsx`) creates marks for the active tab and opens the manage page. The manage page (`src/manage.tsx`) lists marks across pages, supports jump/navigation actions, and edits metadata. Agents may modify source code, styles, tests, and documentation needed to complete requested tasks. Agents must not make unrelated product, release, security, or infrastructure changes unless explicitly requested by a human.

## 2. Repository Map
- `src/index.tsx`, `src/manage.tsx`, `src/settings.tsx`
  - Contains extension UI entrypoints (popup, manage page, settings).
  - Modifiable: **Yes**.
  - Constraints: preserve current user-visible flows unless task explicitly changes them.
- `src/common.tsx`, `src/types.ts`, `src/theme.ts`, `src/theme-toggle.tsx`, `src/styles.css`
  - Shared UI components, state hooks, type definitions, and styling.
  - Modifiable: **Yes**.
  - Constraints: keep shared abstractions backward-compatible for existing callers.
- `src/*.html`
  - HTML shells for extension pages.
  - Modifiable: **Yes**.
  - Constraints: keep page IDs/entrypoint expectations used by Vite and React.
- `public/manifest.json`
  - Extension manifest, permissions, and metadata.
  - Modifiable: **Yes, only when task requires extension capability changes**.
  - Constraints: do not add permissions or host access without explicit request.
- `.github/workflows/release-on-master.yml`
  - Release automation.
  - Modifiable: **Only with explicit request**.
  - Constraints: avoid behavior changes to release process unless requested.
- `.agents/skills/`
  - Shared agent skill definitions tracked in repo.
  - Modifiable: **Yes, when task is agent-behavior related**.
  - Constraints: keep `.claude/skills` symlink target valid.
- `.claude/skills` (symlink)
  - Symlink to shared skills directory.
  - Modifiable: **Yes, only for path/symlink maintenance**.
  - Constraints: must remain a working symlink to `../.agents/skills` unless explicitly changed.
- `build/`
  - Generated build artifacts.
  - Modifiable: **No manual edits**.
  - Constraints: regenerate via build commands only.

## 3. Working Rules
- Keep diffs small and task-scoped; change only files required for the requested outcome.
- Read all directly relevant files before editing any file.
- Do not perform silent refactors; if refactor is necessary, state it and keep it isolated.
- Preserve existing code style, naming patterns, and formatting in touched files.
- Reuse existing abstractions/hooks/components before introducing new ones.
- Do not guess APIs, manifest keys, browser permissions, or library behavior; verify in code or official docs.
- Do not change unrelated logic while touching nearby code.
- Keep imports, exports, and module boundaries consistent with current structure.

## 4. Planning Protocol
- Identify the user request and translate it into one concrete behavior change.
- Read relevant entrypoints, shared modules, and affected types before coding.
- Identify invariants that must not change (storage shape, permissions model, page routing, existing UI flows).
- Write a short implementation plan (3-6 bullets) before edits.
- Implement in small steps following the plan.
- Re-check impacted files after edits for accidental changes.

## 5. Code Change Rules
- Do not rewrite large files when a localized edit solves the problem.
- Do not introduce new frameworks, state libraries, or build tools.
- Do not rename public interfaces, exported types, storage keys, or page routes without explicit request.
- Do not change runtime behavior without a task-linked reason.
- Do not optimize performance without evidence (measurement, profiling, or reproducible bottleneck).
- Keep backward compatibility for persisted data in `chrome.storage.local`.
- Prefer additive and reversible changes over invasive rewrites.

## 6. Testing Requirements
- Run `npm run typecheck` after code changes.
- Run `npm run build` after code changes affecting runtime behavior or packaging.
- Existing tests/checks must pass before completion.
- Add or update tests only when behavior changes or bug fixes require regression coverage.
- Do not create snapshot churn; update snapshots only when intentional behavior changes are confirmed.
- If tests fail, fix the root cause in code; do not patch tests to mask defects.

## 7. Safety Constraints
- Never delete or invalidate data migration paths or persisted storage compatibility.
- Never remove feature flags or permission gates without explicit request.
- Never alter security-sensitive logic (permissions, host access, script injection scope) without explicit request.
- Never modify production/release configuration blindly (`manifest`, workflow, versioning); require task linkage.
- Never commit secrets, tokens, or machine-local config.

## 8. Commit Protocol
- One logical change per commit.
- Commit message format: imperative, concise subject line describing intent.
- Include task/issue context in body when useful (e.g., `Fixes #21`).
- For important user-visible or runtime behavior changes, run `npm run release:patch` before pushing unless a human explicitly requests `minor` or `major`.
- Do not edit version fields manually; use `release-it` so `package.json`, `package-lock.json`, and `public/manifest.json` stay synchronized.
- Stage only relevant files; exclude unrelated local artifacts.
- Do not commit autogenerated noise or transient outputs unless explicitly requested.

## 9. Forbidden Actions
- Do not run destructive git commands (`reset --hard`, `checkout --`, force-push) without explicit request.
- Do not edit `build/` artifacts by hand.
- Do not add dependencies or permissions without explicit request.
- Do not change CI/release workflow without explicit request.
- Do not rewrite unrelated modules during bug fixes.
- Do not fabricate test results, command outputs, or completion status.

## 10. Definition of Done
- [ ] Request scope is fully implemented and limited to relevant files.
- [ ] Relevant files were read before edits and invariants were preserved.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes when runtime/package behavior changed.
- [ ] No unrelated refactors or formatting churn were introduced.
- [ ] No security/permission/release changes were made unless explicitly requested.
- [ ] Diff is reviewable, minimal, and logically grouped.
