/**
 * Permission helpers shared by the auth service and the permissions guard.
 * Permission strings follow `<resource>:<action>`; the wildcard `*` grants
 * everything (used by seeded owner roles).
 */
export function hasPermission(granted: string[], required: string): boolean {
  return granted.includes('*') || granted.includes(required);
}

export function parsePermissions(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === 'string');
  } catch {
    return [];
  }
}
