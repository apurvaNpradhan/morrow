/**
 * Whether the task shortcuts may act: no dialog or menu other than the task
 * sheet is open, since a key pressed there is meant for that dialog.
 */
export function taskHotkeysAllowed() {
  for (const dialog of document.querySelectorAll(
    '[role="dialog"], [role="alertdialog"]',
  )) {
    if (!dialog.matches('[data-slot="sheet-popup"]')) return false;
  }
  return (
    document.querySelector(
      '[data-slot="menu-popup"], [data-slot="menu-sub-content"], [data-slot="context-menu-popup"]',
    ) === null
  );
}
