import { toLocalDateKey } from './utils.js';

function sanitizeFilename(name) {
  return String(name || 'Laporan_Milk_Fresh_POS')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

export function exportRowsToCSV(filenamePrefix, headers, rows) {
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [
    headers.map(escapeCSV).join(','),
    ...rows.map((r) => r.map(escapeCSV).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(filenamePrefix)}_${toLocalDateKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSheetsToExcel(filenamePrefix, sheetsArray) {
  if (!window.XLSX) {
    throw new Error('Library SheetJS (XLSX) belum termuat. Periksa koneksi internet atau gunakan ekspor CSV.');
  }

  const wb = window.XLSX.utils.book_new();

  for (const sheet of sheetsArray) {
    const aoa = [sheet.headers, ...sheet.rows];
    const ws = window.XLSX.utils.aoa_to_sheet(aoa);

    const colWidths = sheet.headers.map((h, colIdx) => {
      let maxLen = String(h || '').length;
      for (const r of sheet.rows) {
        const cellLen = String(r[colIdx] ?? '').length;
        if (cellLen > maxLen) maxLen = cellLen;
      }
      return { wch: Math.min(Math.max(maxLen + 4, 12), 42) };
    });
    ws['!cols'] = colWidths;

    const safeSheetName = String(sheet.sheetName || 'Sheet')
      .replace(/[\\/?*\[\]:]/g, '')
      .slice(0, 31);

    window.XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  }

  window.XLSX.writeFile(wb, `${sanitizeFilename(filenamePrefix)}_${toLocalDateKey()}.xlsx`);
}
