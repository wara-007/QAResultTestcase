# Sidebar navigation implementation plan

**Goal:** Apply the approved sidebar prototype: Sprint pages show only Sprint navigation; Project pages show only Project navigation. Replace year/group links with an explicit parent link.

**Architecture:** Share a presentational navigation component across SprintDashboard and QaWorkspace. Keep existing route loading, permissions, project data and page content. Use explicit parent URLs rather than browser history so direct links also return to the correct Sprint.

**Tech stack:** Next.js 16.3.4, React 19, TypeScript, existing CSS and node:test.

**Approved design:** sidebar-stable-sections.html, scoped-sidebar revision approved in this chat.

## Constraints
- No group/year controls in the sidebar.
- Sprint menu: overview, Projects, team, history.
- Project menu: overview, Test cases, Defects, files, settings.
- Project back returns to the current Sprint's Projects; Sprint back returns to its Sprint list.
- Preserve mobile access and indicate only one current page.

## Implementation
- [x] Add rendering regression tests for exclusive scopes, explicit back routes, active selection and unassigned-project fallback.
- [x] Add `src/components/workspace-sidebar-navigation.tsx` and use it in `sprint-dashboard.tsx` and `qa-workspace.tsx`.
- [x] Style shared navigation, retain project switching, close the mobile drawer when navigating.
- [x] Run rendering tests, existing tests, TypeScript and lint checks; review the final diff.

## Review focus
Direct project URLs must derive Sprint from project metadata. Projects without a Sprint need a valid fallback. Project detail and sheet pages must keep Test cases selected. Team/history links must preserve the correct Sprint. Narrow screens must retain every menu item.

## Validation
- Node 25: all 689 tests pass. The default Node 20 runtime fails five existing Supabase tests because it lacks native WebSocket; rerunning with the project-supported runtime resolves them.
- TypeScript and ESLint for all touched TSX files pass.
- Browser rendering at 1280px and 375px: every link visible, no horizontal clipping, one active link in each scope. This checks isolated navigation rendering, not an authenticated end-to-end session.
