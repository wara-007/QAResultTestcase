# Auth retry still unavailable: project connectivity diagnosis

The Retry link submits a fresh permission check; repeated outage returns the same retry page. No successful login is claimed.

Read-only checks:
- Project DNS resolves IPv4 addresses.
- Requests without API keys reach the edge:401 in about94-136ms, confirmed using Node20, Node24 fetch, native https and curl. This confirms edge connectivity only, not project backend health.
- With the project's publishable key, Auth /health returns no bytes before8-10s client deadline.
- With the configured legacy server key, Auth /health and a REST select of one Sprint ID also return no bytes before10s. Both native fetch and curl reproduce it.
- The server key is unexpired, has service_role metadata and its project reference matches the configured project URL. No key/token values were logged.
- Connected Supabase get_project returned `You do not have permission to perform this action`. No restricted management operation was retried or bypassed.
- Supabase public status reports an ongoing Management API/backplane incident from22October2026. This does not establish that this project outage has the same cause: https://status.supabase.com/incidents/01M5J8ZQ04EZXAYF10Q75MGC1T

Next required evidence: Dashboard service health, database metrics and logs for rxajpslglthchpwkwsie from an account authorized to inspect the project. User asked whether they can access that Dashboard. No restart, permission or configuration change has been made.

User authorized Dashboard inspection in their Safari session. Project Overview confirms status Unhealthy. Health advisor: “Database not usable”, TCP CONNECT_TIMEOUT after5001-5003ms; database did not accept a usable connection. Auth advisor reports69.23% of13requests failing. API Gateway logs show522 for auth token refresh and JWKS endpoints, including Supabase-hosted Deno callers, confirming failures are not limited to local application code. Postgres logs end at19:42:31 with57014; latest displayed checkpoint at19:41:39 completed normally.

Displayed resource gauges:CPU20%, disk17%, RAM65%, connections unavailable. These do not establish current resource exhaustion. Organization quota banner says restrictions from05Nov2026 if still overquota, so it does not prove an active25Oct restriction.

User explicitly approved restarting QAResultTestcase. In Safari Settings > General, opened Restart project, reviewed the downtime confirmation and clicked Restart. Dashboard showed disabled Restarting state. Awaiting service recovery before claiming success. No pause, reset, upgrade or permission changes were selected.

Recovery verified after the approved restart: Auth health200 in957ms; Supabase SDK reads the Sprint row in270ms. Raw REST with only the legacy API-key header returned401/42501 (not an availability failure); authenticated SDK read succeeds. Dashboard status Healthy, CPU4%, disk17%, RAM52%, connections5/60. Clicking Retry in the existing in-app session returns to the Pay ban Workspace without changing account approval. Successful recovery establishes that the immediate login block was the unavailable project backend; available evidence still does not establish the underlying host failure mechanism (e.g. OOM versus provider networking).

End-to-end recovery verified:
- Existing in-app session returns through Retry to the Pay ban test case page;42 registered cases,239/239 evidence references and23/23 tabs remain available.
- Original Sprint overview URL opens in Chrome and renders112cases across4projects (Pass95,Failed0).
- Screenshot: /Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/sprint-recovered-after-supabase-restart.png
- Immediate failure is established as project-level Supabase service unavailability (TCP connection timeout /522), plus the separately repaired application misclassification of lookup errors as absent approval. Exact host-level cause remains unproven; no evidence-based attribution to quota, CPU or memory exhaustion is made.
