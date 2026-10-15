# Waiver rules and ownership

- `service.ts` owns template selection, signature persistence/revisions, checkout
  requirements, signed-record authorization/history, and invitation campaigns.
- `signature.ts` owns participant validation and signing statements; `policy.ts`
  owns completion checks shared with the browser. A family membership needs a
  household signature, even if an individual signature already exists.
- `config.ts` validates the independent server-only IP-hashing key before signup
  form loading, signing, and campaign sending. The key is not a certificate.
- `navigation.ts` owns allowlisted signing/login continuations. `client.ts` owns
  account-scoped private queries and rejects a response for a different account.
- The configured primary admin is an administrative account, never a participant.
  `primary-admin.ts` owns its identity, `Membership.ensureMemberProfile` skips
  member-profile creation for it, and the waiver service rejects personal signing
  and excludes it from completion/invitation audiences. Organizers are people with
  memberships and still need individual or household signatures. Admin access to
  other members' records and organizer-role management are unchanged.
- Membership status and price-to-plan facts stay in `membership-status.ts` and
  `membership-plans-config.ts`. The database membership service provides current
  contact/plan data; waiver reporting does not query membership tables directly.
- Email delivery and configuration checks stay in `EmailService`. Administrators
  explicitly launch a campaign. Only successful provider submissions consume a
  recipient's one-time invitation; failures can be retried.
- Individual and selected invitations use that same campaign owner; selections never
  expand to all members implicitly. `email-schemas.ts` defines explicit invite,
  confirmed reminder, and self-test requests, with batches limited to 20 recipients.
  Reminders use the last successful email ID as the concurrency/replay guard and
  provider idempotency key. Failed reminders preserve that ID for a safe retry.
  The email-log persistence owner supplies latest successful/failed status in bulk.
- `email-content.ts` owns the subject, variables, batch limit, and escaped preview
  substitution. `EmailService` sends through the published Resend template and reads
  it for preview; the browser never receives a provider key. Previews are sandboxed.
  Admin tests use only the authorized session email and do not create member records
  or consume invitations. Template lifecycle checks apply to previews and tests too.
- Sending is paced and batched, not a durable outbox. A provider success followed by
  a failed database log is protected by Resend idempotency for 24 hours only; an
  unresolved ambiguous result needs operator investigation before retrying later.

## Version lifecycle

Within a title/scope, only the newest published, effective version is signable.
Future versions do not suppress the present version. Publication is one atomic
update; it never rewrites a predecessor's dates. Canceling a scheduled version
leaves its predecessor available. Retiring an effective version also retires its
effective predecessors, preventing old wording from reappearing. Expired newer
versions continue to suppress older published versions. Signed snapshots and all
revisions remain accessible regardless of current template or membership status.

All active required membership forms must be signed before checkout. Server-side
checks remain authoritative when browser data is stale. Other active required
forms also appear in the authenticated signing gate; this is not ride check-in
enforcement. Membership-card scanning remains a separate product limitation.

## Enforcement

The normal Vitest suite covers real SQL selection using an isolated in-memory
database, signature revisions/authorization, imported-family classification,
invitation retries/preflight, account cache separation, and signup/login recovery.
CI invokes that suite. These checks do not verify actual inbox delivery, Stripe's
hosted UI, legal enforceability, or all module boundaries; those require separate
operational/legal review. There is no separate waiver CI job or local test stack.
