let pendingInvitationToken: string | null = null;

/** Keep an invitation token in memory only while the user signs in. */
export function setPendingInvitationToken(token: string): void {
  pendingInvitationToken = token;
}

export function takePendingInvitationToken(): string | null {
  const token = pendingInvitationToken;
  pendingInvitationToken = null;
  return token;
}

export function clearPendingInvitationToken(): void {
  pendingInvitationToken = null;
}
