/** Homepage promotion only; Cognative remains authoritative for checkout pricing. */
export const jerseyPreorder = {
  url: 'https://cognativemtb.com/collections/down-east-cyclists-pre-order',
  deadlineLabel: 'Sunday, November 15, 2026',
  deadlineDate: '2026-11-15',
  // Midnight after the final preorder day in North Carolina (Eastern Standard Time).
  expiresAt: Date.parse('2026-11-16T00:00:00-05:00'),
  shortSleevePrice: '$59.95',
  longSleevePrice: '$69.95',
} as const;

export function isJerseyPreorderActive(now: number): boolean {
  return now < jerseyPreorder.expiresAt;
}
