const { google } = require('googleapis');
const credentials = require('./credentials.json');
require('dotenv').config(); 
// Load environment variables
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;

// Configure the JWT client for authentication
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Adds a new row to the Google Sheet with subscriber data.
 * @param {string} name - The subscriber's name.
 * @param {string} email - The subscriber's email.
 * @param {string} subscription_id - The Razorpay subscription ID.
 */
async function addRow(name, email, subscription_id) {
  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:C`, // Assumes columns are Name, Email, Subscription ID
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

/**
 * Removes a row from the Google Sheet based on the subscription ID.
 * @param {string} subscription_id - The Razorpay subscription ID to find and remove.
 */
async function removeRow(subscription_id) {
  try {
    // Get all the data from the sheet to find the row number
    const getRowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C:C`, // Assuming Subscription ID is in column C
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
        spreadsheetId: SPREADSHEET_ID,
        // Assuming you want to clear from column A to C for the found row
        range: `${SHEET_NAME}!A${rowToClear}:C${rowToClear}`,
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

module.exports = { addRow, removeRow };