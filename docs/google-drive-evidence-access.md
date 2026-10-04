# Shared Google Drive evidence access

QA evidence is read using the existing server-side Google Service Account, not
the viewer's Google OAuth connection. The QA route first requires a signed-in
user, an exact saved evidence reference, and current Project view capability.
The approvals route first verifies the recipient and the evidence in that review.
Neither route accepts an arbitrary Drive file as authorization.

## Deployment

Set these server-only variables on the hosting provider and redeploy:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (the same key used for Sheets; escaped
  `\n` line breaks are supported)

Existing Drive uploads already grant this account reader permission. If an old
file cannot be read, its owner must share the evidence file or its containing
folder with the configured service-account email as Viewer. Sharing a spreadsheet
does not by itself share separate evidence files. Do not share an entire personal
Drive, expose the private key in the browser, or grant users broader Project rights.

This change does not migrate files to R2, modify Sheets, or alter existing public
sharing used by Sheets IMAGE formulas. Drive quota and hosting bandwidth/function
limits still apply. A viewer does not need to connect Google just to view evidence;
uploading or synchronizing Sheets retains the existing authorization flow.

## Verification

- Test an existing Drive evidence URL while logged in with a different QA account.
- Test the same Project's review as its PO recipient.
- A logged-out request must return 401, not image bytes.
- A file absent from an accessible Project/review must not be served.
- If Google access is missing, the API reports that the central account needs
  access, rather than asking the viewer to connect their Google account.

Media responses use private `no-store` caching so current permissions are checked
on each request, including after logout or revoked access.
