export const POS_MODAL = {
  padding: 14,
  radius: 16,
  gap: 10,
  closeButtonHeight: 32,
  titleSize: 18,
  titleLineHeight: 22,
  eyebrowSize: 10
};

export function getPosDialogWidth(screenWidth, maxWidth = 420) {
  return Math.min(Math.max(screenWidth - 32, 0), maxWidth);
}
