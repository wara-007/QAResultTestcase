# Login permission-check outage handling

Root cause: resolveAppRole treated RPC/query failures as absent authorization. Modern-role failure could fall through to legacy QA authorization and an administrative PO invitation lookup; failed lookup then returned null. Login/access-denied pages rendered that null as waiting for owner approval. The proxy also permitted protected requests when its allowlist query failed.

Fix:
- Successful get_my_app_role qa/po/null is authoritative. Only missing-function errors use verified legacy compatibility. Other lookup errors stop role resolution; no fallback grants or pending-access claims.
- Bound role/allowlist RPC requests to12seconds. Retryable claims errors remain service failures rather than signed-out sessions.
- Login and pending-access pages show a retryable permission-check outage; account-not-approved copy requires a successfully checked signed-in session.
- Password and Google flows preserve the intended destination on role lookup failure. Password authentication service failures no longer imply incorrect credentials. OAuth role retry preserves Drive session cookies.
- Protected APIs return503 for unresolved allowlist/authentication service errors. Protected pages show the retry flow. Refresh cookies are preserved; confirmed denial remains denied.

Verification:589 tests pass; production build, focused ESLint, read-only workspace checks and diff checks pass. Independent security/correctness reviewer reported no blockers. Live browser confirmed retry changes the URL to login with the original next destination and displays “ตรวจสอบสิทธิ์ไม่สำเร็จ”, not “ยังไม่ได้รับอนุมัติ”. The underlying database lookup remains unavailable, so successful account access is not claimed. No database grants or account approval changes were made.
