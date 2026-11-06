/** Échappement CSV sûr (préfixe anti-formule sur les cellules dangereuses). */

const DANGEROUS_START = /^[=+\-@\t\r]/;

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  if (DANGEROUS_START.test(s)) s = `'${s}`; // bloque l'injection de formule Excel
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: CsvValue[]): string {
  return cells.map(csvCell).join(',');
}

/** Télécharge un CSV généré côté client (les URLs de campagne ne sortent jamais du navigateur). */
export function downloadCsv(filename: string, rows: CsvValue[][]) {
  const csv = rows.map((r) => csvRow(r)).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
