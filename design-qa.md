# Design QA

- Source visual truth: `/Users/wara/.codex/generated_images/01a06af2-dcba-7822-a998-7b23ed635bb9/exec-0a418ef5-4ace-47c9-929d-224333632472.png`
- Rendered implementation: `http://localhost:3002/groups/default/projects/833a8201-b4e7-46a7-bdba-232b3c0613cf/test-cases`
- Viewport: 1440 × 900 CSS px, desktop density 1×
- Source pixels: 1776 × 887
- Implementation capture: 1440 × 900
- State: Existing project, Test cases route, 32 real test cases loaded

## Findings

- No actionable P0/P1/P2 differences remain for the requested information architecture and routing change.
- The implementation intentionally keeps the existing dark sidebar and established product tokens instead of replacing the application's design system with the lighter concept styling.
- Project-level navigation appears only after entering a project. The group Projects page exposes only group-level navigation.

## Required fidelity surfaces

- Fonts and typography: Existing system font scale, weight hierarchy, truncation, and Thai/English rendering remain consistent across new routes.
- Spacing and layout rhythm: Project navigation, content header, table, responsive sidebar, and empty states align to the existing 246 px shell and spacing tokens.
- Colors and visual tokens: Existing navy sidebar, blue active state, neutral canvas, semantic green/red status colors, borders, and shadows are reused consistently.
- Image quality and assets: No new raster assets are required. Product icons use the project's existing icon package and remain crisp at desktop and mobile sizes.
- Copy and content: Group-level and project-level labels match the approved structure: ภาพรวม, Test cases, Defects, เอกสาร/ไฟล์, ตั้งค่า.

## Interaction and route verification

- Opened the Projects list and entered the real project through its card.
- Navigated to the Test cases route through the project sidebar.
- Refreshed the Test cases route and confirmed both the URL and active sidebar item persisted.
- Verified real test-case data reloaded after refresh.
- Verified the production build, TypeScript, and ESLint checks pass.
- Browser console was checked after the final fix; the earlier hot-reload error was resolved and did not recur.

## Focused comparison

- Focused review covered the left navigation hierarchy and Test cases content header because those are the areas changed by this iteration. Table styling and drawer internals were unchanged from the existing product.

## Comparison history

- Initial P0: importing a runtime array from a client component into the route server component caused the first project route to fail.
- Fix: moved route validation data into the server route module while retaining the shared TypeScript page-name type.
- Post-fix evidence: project Overview and Test cases routes rendered successfully; refresh preserved `/test-cases` and the active navigation state.

## Follow-up polish

- P3: Replace the temporary `default` group slug with a real group ID after group persistence and authentication are implemented.

final result: passed
