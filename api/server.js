require('dotenv').config(); 

const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const path = require('path');
const { addRow, removeRow, updateRow, removeExpiredCancellations } = require('./sheets.js');


const app = express();

const allowedOrigins = [
  "https://www.editionaly.website",
  "https://editionaly-website-1jwo1wcfp-mohammed-zaids-projects-8ec0dbe5.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json()); // ✅ only this


// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '/')));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.get('/get-razorpay-key', (req, res) => {
  res.json({ key_id: process.env.RAZORPAY_KEY_ID });
});

// Get plan_id from environment variables
const PLAN_ID = process.env.RAZORPAY_PLAN_ID;

app.post('/create-subscription', async (req, res) => {
  try {
    const { name, email } = req.body;
    console.log('Creating subscription for:', { name, email });

    const subscription = await razorpay.subscriptions.create({
      plan_id: PLAN_ID,
      customer_notify: 1,
      total_count: 12, // 12 months
      notes: { name, email } // Pass name and email in notes
    });

    console.log('Subscription created:', subscription.id);

    // DO NOT add to Google Sheets here.

    res.json({ subscription_id: subscription.id });
  } catch (err) {
    console.error('Error creating subscription:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Razorpay webhook for subscription events


app.post('/razorpay-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('Webhook received:', event.event);

    if (event.event === 'subscription.charged') {
      const { subscription } = event.payload;
      console.log('Subscription entity:', JSON.stringify(subscription.entity, null, 2));

      const { name, email } = subscription.entity.notes;
      const subscription_id = subscription.entity.id;
      console.log('Subscription payment successful:', { name, email, subscription_id });

      // Add subscriber to Google Sheets on successful payment
      try {
        await addRow(process.env.GOOGLE_SHEET_ID, process.env.GOOGLE_SHEET_NAME, name, email, subscription_id);
      } catch (sheetError) {
        console.error('Failed to add to Google Sheets:', sheetError.message);
      }
    }

    if (event.event === 'subscription.cancelled') {
      const subscription_id = event.payload.subscription.entity.id;
      console.log('Subscription cancelled:', subscription_id);
      
      const cancellation_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      try {
        await updateRow(process.env.GOOGLE_SHEET_ID, process.env.GOOGLE_SHEET_NAME, subscription_id, cancellation_date);
      } catch (sheetError) {
        console.error('Failed to update Google Sheets for cancellation:', sheetError.message);
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('error');
    
  }
});

app.post('/api/cleanup-subscriptions', async (req, res) => {
    try {
        console.log('Cleanup process started...');
        await removeExpiredCancellations(process.env.GOOGLE_SHEET_ID, process.env.GOOGLE_SHEET_NAME);
        console.log('Cleanup process finished.');
        res.status(200).send('Cleanup finished');
    } catch (err) {
        console.error('Error during cleanup:', err.message);
        res.status(500).send('Error during cleanup');
    }
});

module.exports = app;
//const PORT = process.env.PORT || 3001;
// /app.listen(PORT, () => console.log(`Server running on port ${PORT}`));