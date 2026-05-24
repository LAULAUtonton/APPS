const SHEET_NAME = 'FlightPoints';
const SHARED_TOKEN = 'CHANGE_ME_TOKEN';

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (!payload || payload.token !== SHARED_TOKEN) {
      return jsonResponse({ success: false, error: 'Unauthorized token' });
    }

    if (!payload.childName || !payload.date || !payload.weekStart) {
      return jsonResponse({ success: false, error: 'Missing required fields' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ success: false, error: 'Sheet not found: ' + SHEET_NAME });
    }

    var row = [
      payload.timestamp || '',
      payload.date,
      payload.weekStart,
      payload.childName,
      Boolean(payload.tidyRoom),
      Boolean(payload.exercise),
      Boolean(payload.typing),
      Boolean(payload.duolingo),
      Boolean(payload.reading),
      Boolean(payload.music),
      Boolean(payload.schoolTaskDone),
      Boolean(payload.freeMissUsed),
      Number(payload.positivePoints || 0),
      Number(payload.penalties || 0),
      Number(payload.netPoints || 0),
      Number(payload.computerMinutesEarned || 0),
      Number(payload.computerMinutesRedeemed || 0),
      payload.notes || ''
    ];

    sheet.appendRow(row);
    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}