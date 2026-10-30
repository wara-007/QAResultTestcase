# Project team participation

Goal: retain existing overview content and add team participation above recent activity.

- [x] Inspect overview and registered case data.
- [x] Test pure aggregation: distinct cases per person, distinct steps, latest outcome, no inferred step credit.
- [x] Add accessible expandable team panel using already loaded cases, above recent activity.
- [x] Typecheck, lint and all 721 tests pass.
- [ ] Visual verification in running app: no local server available; sandbox blocks binding a preview port and browser policy blocks file URLs. Responsive CSS and SSR expand/collapse markup verified; browser screenshot remains unverified.

Decisions: count each person/case once, each person/step once; never convert a case result to all-step credit. Step detail only reflects loaded, explicitly mapped data. Keep progress, recent activity, approval and existing summary intact. No new network requests.
