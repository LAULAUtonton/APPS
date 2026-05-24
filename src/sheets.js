export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN || '';

export async function postRecordToSheets(record) {
  if (!APPS_SCRIPT_URL) {
    return {
      success: false,
      warning: 'Google Sheets endpoint is not configured. Saved locally only.'
    };
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...record, token: APPS_SCRIPT_TOKEN })
    });

    const raw = await response.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      return {
        success: false,
        warning: 'Sheets sync failed: endpoint returned non-JSON response.'
      };
    }

    return { success: Boolean(data?.success), data };
  } catch (error) {
    return {
      success: false,
      warning: `Sheets sync failed: ${error.message}`
    };
  }
}