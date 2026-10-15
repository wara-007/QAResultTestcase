/** Google values omit unused trailing cells; formatting should use those bounds. */
export function googleDataRange(name: string, rows: unknown[][]): string {
  let lastRow = 1, lastColumn = 1;
  rows.forEach((row, r) => row.forEach((value, c) => {
    if (value !== '' && value != null) {
      lastRow = Math.max(lastRow, r + 1);
      lastColumn = Math.max(lastColumn, c + 1);
    }
  }));
  let column = '', number = lastColumn;
  while (number > 0) {
    number--;
    column = String.fromCharCode(65 + number % 26) + column;
    number = Math.floor(number / 26);
  }
  return `'${name.replaceAll("'", "''")}'!A1:${column}${lastRow}`;
}
