const { google } = require('googleapis');
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// Configure the JWT client for authentication
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Adds a new row to the Google Sheet with subscriber data.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @param {string} sheetName The name of the sheet.
 * @param {string} name - The subscriber's name.
 * @param {string} email - The subscriber's email.
 * @param {string} subscription_id - The Razorpay subscription ID.
 */
async function addRow(spreadsheetId, sheetName, name, email, subscription_id) {
  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:C`, // Assumes columns are Name, Email, Subscription ID
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[name, email, subscription_id]],
      },
    });
    console.log('Added to Google Sheets:', res.data);
    return res.data;
  } catch (err) {
    console.error('Error adding to Google Sheets:', err.message);
    throw new Error('Could not add data to Google Sheet.');
  }
}

async function updateRow(spreadsheetId, sheetName, subscription_id, cancellation_date) {
    try {
        const getRowsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!C:C`,
        });

        const rows = getRowsRes.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in the sheet to update.');
            return;
        }

        const rowIndex = rows.findIndex(row => row[0] === subscription_id);

        if (rowIndex === -1) {
            console.log(`Subscription ID ${subscription_id} not found for update.`);
            return;
        }

        const rowToUpdate = rowIndex + 1;

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!D${rowToUpdate}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[cancellation_date]],
            },
        });

        console.log(`Row for subscription ${subscription_id} updated with cancellation date.`);

    } catch (err) {
        console.error('Error updating Google Sheets:', err.message);
        throw new Error('Could not update data in Google Sheet.');
    }
}

async function removeExpiredCancellations(spreadsheetId, sheetName) {
    try {
        const getRowsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!C:D`, // Get subscription_id and cancellation_date
        });

        const rows = getRowsRes.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in the sheet for cleanup.');
            return;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const subsToRemove = [];
        for (const row of rows) {
            const subscription_id = row[0];
            const cancellation_date_str = row[1];

            if (cancellation_date_str) {
                const cancellation_date = new Date(cancellation_date_str);
                if (cancellation_date < thirtyDaysAgo) {
                    subsToRemove.push(subscription_id);
                }
            }
        }

        if (subsToRemove.length > 0) {
            console.log(`Found ${subsToRemove.length} expired subscriptions to remove.`);
            for (const sub_id of subsToRemove) {
                await removeRow(spreadsheetId, sheetName, sub_id);
            }
            console.log('Expired subscriptions removed successfully.');
        } else {
            console.log('No expired subscriptions found.');
        }

    } catch (err) {
        console.error('Error during expired cancellation removal:', err.message);
        throw new Error('Could not remove expired cancellations from Google Sheet.');
    }
}

/**
 * Removes a row from the Google Sheet based on the subscription ID.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @param {string} sheetName The name of the sheet.
 * @param {string} subscription_id - The Razorpay subscription ID to find and remove.
 */
async function removeRow(spreadsheetId, sheetName, subscription_id) {
  try {
    // Get all the data from the sheet to find the row number
    const getRowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!C:C`, // Assuming Subscription ID is in column C
    });

    const rows = getRowsRes.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in the sheet to remove.');
      return;
    }

    // Find the 1-based row index that matches the subscription_id
    const rowIndex = rows.findIndex(row => row[0] === subscription_id);

    if (rowIndex === -1) {
      console.log(`Subscription ID ${subscription_id} not found in the sheet.`);
      return;
    }

    const rowToClear = rowIndex + 1;

    // Clear the contents of the entire row
    await sheets.spreadsheets.values.clear({
        spreadsheetId: spreadsheetId,
        // Assuming you want to clear from column A to C for the found row
        range: `${sheetName}!A${rowToClear}:C${rowToClear}`,
    });

    console.log(`Row for subscription ${subscription_id} cleared successfully.`);

  } catch (err) {
    console.error('Error removing from Google Sheets:', err.message);
    throw new Error('Could not remove data from Google Sheet.');
  }
}

/**
 * Helper function to get the numeric ID of a sheet by its name.
 * @param {string} sheetName - The name of the sheet.
 * @returns {number} The numeric ID of the sheet.
 */
async function getSheetId(sheetName) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet with name "${sheetName}" not found.`);
  }
  return sheet.properties.sheetId;
}

module.exports = {
  addRow,
  removeRow,
  updateRow,
  removeExpiredCancellations
};