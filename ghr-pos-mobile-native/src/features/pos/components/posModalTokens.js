export const POS_MODAL = {
  padding: 18,
  radius: 16,
  gap: 12,
  closeButtonHeight: 44,
  titleSize: 22,
  titleLineHeight: 28,
  eyebrowSize: 11
};

export function getPosDialogWidth(screenWidth, maxWidth = 420) {
  return Math.min(Math.max(screenWidth - 24, 0), maxWidth);
}
