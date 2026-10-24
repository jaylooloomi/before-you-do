export function matchesShortcutEvent(event, shortcut) {
  const alt = shortcut.modifier.startsWith('alt');
  if (!!event.altKey !== alt || !!event.ctrlKey !== !alt || !!event.shiftKey !== shortcut.modifier.endsWith('Shift') || event.metaKey) return false;
  const code = shortcut.key === 'Space' ? 'Space' : /^\d$/.test(shortcut.key) ? `Digit${shortcut.key}` : `Key${shortcut.key}`;
  return event.code ? event.code === code : (shortcut.key === 'Space' ? event.key === ' ' : event.key?.toUpperCase() === shortcut.key);
}
