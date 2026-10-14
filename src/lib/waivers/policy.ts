export function isWaiverComplete(
  waiver: {isSigned: boolean; signerRole: string | null},
  requireHousehold: boolean,
): boolean {
  return waiver.isSigned && (!requireHousehold || waiver.signerRole === 'household');
}
