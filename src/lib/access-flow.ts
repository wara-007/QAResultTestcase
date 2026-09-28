export type AppRole = "qa" | "po";

function safeRequestedPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/groups";
}

export function destinationForRole(role: AppRole, requestedPath: string) {
  const target = safeRequestedPath(requestedPath);
  if (target === "/auth/update-password") return target;
  if (role === "po") return target === "/approvals" || target.startsWith("/approvals/") ? target : "/approvals";
  return target === "/groups" || target.startsWith("/groups/") || target.startsWith("/admin/") ? target : "/groups";
}

export function authorizedDestination(role: AppRole, requestedPath: string, passwordConfigured: boolean) {
  return passwordConfigured ? destinationForRole(role, requestedPath) : "/auth/update-password";
}

export function pendingAccessDestination(email: string, requestedPath: string) {
  const params = new URLSearchParams();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail) params.set("email", normalizedEmail);
  params.set("next", safeRequestedPath(requestedPath));
  return `/auth/access-denied?${params.toString()}`;
}
