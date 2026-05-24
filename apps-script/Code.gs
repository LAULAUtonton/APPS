function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var row = [
      payload.timestamp,
      payload.date,
      payload.weekStart,
      payload.childName,
      payload.tidyRoom,
      payload.exercise,
      payload.typing,
      payload.duolingo,
      payload.reading,
      payload.music,
      payload.schoolTaskDone,
      payload.freeMissUsed,
      payload.positivePoints,
      payload.penalties,
      payload.netPoints,
      payload.computerMinutesEarned,
      payload.computerMinutesRedeemed,
      payload.notes
    ];
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(error) })).setMimeType(ContentService.MimeType.JSON);
  }
}
