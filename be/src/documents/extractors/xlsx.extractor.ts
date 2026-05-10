import * as XLSX from 'xlsx';

export async function extractXlsxText(filePath: string): Promise<string> {
  const workbook = XLSX.readFile(filePath);
  let text = '';

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    text += JSON.stringify(rows) + '\n';
  });

  return text.trim();
}
