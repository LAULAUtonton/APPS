export const APPS_SCRIPT_URL = '';

export async function postRecordToSheets(record) {
  if (!APPS_SCRIPT_URL) {
    return { success: false, warning: 'Google Sheets endpoint is not configured. Saved locally only.' };
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    const data = await response.json();
    return { success: Boolean(data?.success), data };
  } catch (error) {
    return { success: false, warning: `Sheets sync failed: ${error.message}` };
  }
}
