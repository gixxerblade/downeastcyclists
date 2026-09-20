-- Renewal previously updated a card's dates without moving its membership FK.
-- Relink only when the card exactly identifies one other term for the same user.
-- Preserve historical memberships, card numbers, QR payloads, and validity dates.
WITH matching_terms AS (
  SELECT c.id AS card_id, m.id AS membership_id,
    count(*) OVER (PARTITION BY c.id) AS matches
  FROM membership_cards c
  JOIN memberships m ON m.user_id = c.user_id
    AND m.start_date = c.valid_from
    AND m.end_date = c.valid_until
    AND m.plan_type = c.plan_type
    AND m.status = c.status
)
UPDATE membership_cards c
SET membership_id = matching_terms.membership_id, updated_at = now()
FROM matching_terms
WHERE matching_terms.card_id = c.id
  AND matching_terms.matches = 1
  AND c.membership_id <> matching_terms.membership_id;
