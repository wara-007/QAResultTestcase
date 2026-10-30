export type ApprovalOutlookDraft = {
  senderEmail: string;
  recipientEmail: string;
  cc: string[];
  subject: string;
  body: string;
};

// Keep links short for browser/desktop mail handlers. The dialog retains every
// field for copying when a complete email cannot fit into the compose link.
export function outlookComposeLink(draft: ApprovalOutlookDraft) {
  const base = `mailto:${encodeURIComponent(draft.recipientEmail).replace(/%40/g, "@")}`;
  const headers = `cc=${encodeURIComponent(draft.cc.join(","))}&subject=${encodeURIComponent(draft.subject)}`;
  const body = draft.body.replace(/\r?\n/g, "\r\n");
  const complete = `${base}?${headers}&body=${encodeURIComponent(body)}`;
  if (complete.length <= 1800) return {url: complete, headersIncluded: true, bodyIncluded: true};
  const headerOnly = `${base}?${headers}`;
  if (headerOnly.length <= 1800) return {url: headerOnly, headersIncluded: true, bodyIncluded: false};
  return {url: base, headersIncluded: false, bodyIncluded: false};
}
