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
  recipient's one-time invitation. A durable reservation is required before contacting
  the provider; only a definite rejection releases it for retry.
- Individual and selected invitations use that same campaign owner; selections never
  expand to all members implicitly. `email-schemas.ts` defines explicit invite,
  confirmed reminder, and self-test requests, with batches limited to 20 recipients.
  Reminders use the last successful email ID in their durable operation key.
  `database-audit.methods.ts` atomically reserves that key in the existing email log;
  concurrent requests cannot acquire it twice. Each acquired attempt has its own
  provider idempotency key and only that attempt can finalize its pending record.
  Definite rejections release the operation key, preserving failed history and the
  previous successful email ID. The email-log owner supplies all status kinds in bulk.
- `email-content.ts` owns the subject, variables, batch limit, and escaped preview
  substitution. `EmailService` sends through the published Resend template and reads
  it for preview; the browser never receives a provider key. Previews are sandboxed.
  Admin tests use only the authorized session email and do not create member records
  or consume invitations. Template lifecycle checks apply to previews and tests too.
- Sending is paced and batched, not a background outbox. Resend acceptance stores
  its email ID. Timeouts, server errors, idempotency conflicts, missing response IDs,
  and unknown errors are uncertain, not definite rejection. A lost completion write
  leaves the original pending reservation intact. Neither pending nor uncertain
  reservations expire automatically, even after the provider's 24-hour window.
  Both block invitation/reminder actions until reviewed. No new secrets are needed.

## Delivery recovery

Migration `0014_waiver_email_delivery_claims` must run before the new code. It preserves
legacy logs (including duplicate historical provider keys); the unique nullable
`operation_key` applies only to new reservations. It cannot reconstruct unlogged sends
from older deployments, so investigate any known pre-upgrade ambiguous outcomes first.

The admin table marks in-progress/unresolved sends. Refresh first: an active request may
still finish. If a row remains pending or uncertain, a site operator must reconcile it
with Resend. Do not re-send from the provider dashboard or clear a reservation merely
because 24 hours passed. Self-tests are separate, intentional admin-only messages and
do not reserve member invitations.

1. Find the exact attempt in `email_log` by member/campaign and status `pending` or
   `uncertain`. Keep its row ID, recipient, timestamp, operation key, and idempotency key.
2. Wait for the original worker to finish/terminate. Check Resend request/email logs
   for that exact key and recipient. An empty search or missing logs is **not** proof
   that delivery never happened; leave the reservation blocked if still uncertain.
3. If Resend accepted it, record its provider email ID and set that exact row to
   `sent`, retaining `operation_key`. The table then offers a separately confirmed
   reminder (if the member is still unsigned). Acceptance does not imply inbox delivery.
4. Only if provider evidence confirms it was **not accepted**, set that exact row to
   `failed` and clear `operation_key` in the same update. Record the review reason in
   `error_message`. The original attempt remains in history and an admin can retry.

These are deliberate operator-only database corrections, not a bulk action. Match the
row ID, expected operation key, and current `pending`/`uncertain` status in the update;
verify exactly one row changed and record the evidence/reviewer in the incident log.
Never delete history or release a live worker's reservation. The normal send path
cannot perform these corrections. This is the availability tradeoff for avoiding an
automatic duplicate when the provider's outcome cannot be established.

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
invitation retries/preflight, concurrent invitations/reminders, durable claims after
provider/logging failures, provider-outcome classification, migration preservation,
account cache separation, and signup/login recovery.
CI invokes that suite. These checks do not verify actual inbox delivery, Stripe's
hosted UI, legal enforceability, or all module boundaries; those require separate
operational/legal review. There is no separate waiver CI job or local test stack.
