export function closeOnlyOnBackdrop(event, onClose) {
  if (event.target === event.currentTarget) onClose();
}
