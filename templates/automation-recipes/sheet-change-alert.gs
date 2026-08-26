// Google Apps Script — emails you whenever a specific column changes value
// in your Google Sheet (e.g. an order's "status" column). 100% free.

const WATCH_COLUMN = "C"; // change to the column you want to monitor
const NOTIFY_EMAIL = "your-email@example.com";

function onEdit(e) {
  const range = e.range;
  if (range.getColumn() !== columnLetterToIndex(WATCH_COLUMN)) return;

  const sheet = range.getSheet();
  const row = range.getRow();
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  MailApp.sendEmail(
    NOTIFY_EMAIL,
    `تغيير في الصف ${row}`,
    `تم تحديث العمود ${WATCH_COLUMN} إلى: ${e.value}\n\nبيانات الصف كاملة:\n${rowData.join(" | ")}`
  );
}

function columnLetterToIndex(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index;
}
