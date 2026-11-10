const paths = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.7"/>',
  production: '<path d="M4 20V8l8-5 8 5v12Z"/><path d="m4 8 8 5 8-5M12 13v7"/>',
  investors:
    '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m4 6 12-3v3m5 5h-5a2 2 0 0 0 0 4h5"/><circle cx="16.8" cy="13" r=".65" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  arrowUpRight: '<path d="M6 18 18 6M7 6h11v11"/>',
  share: '<path d="m9 8 3-3 3 3m-3-3v11"/><path d="M7 10H5v10h14V10h-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  settings:
    '<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  stack: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
  chart: '<path d="M3 4v16h18M6 15l4-5 4 2 6-7"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 16V7h4a3 3 0 0 1 0 6H8m0 2h5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  timing: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 13h8m-8 4h6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
};
export function icon(key, size = 20) {
  return (
    '<svg class="glyph" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (paths[key] || paths.info) +
    '</svg>'
  );
}
