// Google Apps Script — exports the active sheet to a PDF and saves it into
// a Google Drive folder every week. 100% free (Google account only).

const BACKUP_FOLDER_ID = "PASTE_YOUR_DRIVE_FOLDER_ID_HERE";

function weeklyBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const url = ss.getUrl().replace(/edit$/, "") +
    `export?format=pdf&gid=${ss.getActiveSheet().getSheetId()}`;

  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  folder.createFile(response.getBlob().setName(`backup-${dateStr}.pdf`));
}

// After pasting this script: open Triggers (⏰) → Add Trigger → function
// "weeklyBackup" → Event source "Time-driven" → "Week timer".
