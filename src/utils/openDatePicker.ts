export function openDatePicker(input: HTMLInputElement) {
  input.focus();

  if (typeof input.showPicker !== 'function') return;

  try {
    input.showPicker();
  } catch {
    // Some browsers block showPicker outside direct pointer gestures.
  }
}
