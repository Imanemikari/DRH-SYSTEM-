// Excel-like keyboard navigation for data grids.
// Focusable cells carry data-r (row) + data-c (col); arrows move focus
// within the closest enclosing table. Returns true when handled.
export function moveInTable(
  e: { target: unknown; preventDefault: () => void; key: string },
  r: number,
  c: number
): boolean {
  const k = e.key;
  let nr = r;
  let nc = c;
  if (k === 'ArrowUp') nr = r - 1;
  else if (k === 'ArrowDown') nr = r + 1;
  else if (k === 'ArrowLeft') nc = c - 1;
  else if (k === 'ArrowRight') nc = c + 1;
  else return false;
  const t = e.target as { closest?: (s: string) => unknown } | null;
  const table = t && t.closest ? (t.closest('table') as unknown as { querySelector?: (s: string) => unknown } | null) : null;
  const el = table && table.querySelector
    ? (table.querySelector('[data-r="' + nr + '"][data-c="' + nc + '"]') as unknown as { focus?: () => void } | null)
    : null;
  if (el && el.focus) {
    e.preventDefault();
    el.focus();
    return true;
  }
  return false;
}

// Focus a cell directly (used after Enter-to-save in numeric grids).
export function focusCell(table: unknown, r: number, c: number): boolean {
  try {
    const t = table as { querySelector?: (s: string) => unknown } | null;
    if (!t || !t.querySelector) return false;
    const el = t.querySelector('[data-r="' + r + '"][data-c="' + c + '"]') as unknown as { focus?: () => void } | null;
    if (el && el.focus) {
      el.focus();
      return true;
    }
  } catch { /* noop */ }
  return false;
}
