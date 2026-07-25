export function getPrimaryAdminEmail(): string {
  return (
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL_WHITELIST?.split(',')[0] ||
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL ||
    'info@downeastcyclists.com'
  )
    .trim()
    .toLowerCase();
}

export function isPrimaryAdminEmail(email: string | undefined): boolean {
  return email?.trim().toLowerCase() === getPrimaryAdminEmail();
}
