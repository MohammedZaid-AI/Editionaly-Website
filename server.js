const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const path = require('path');
const { addRow, removeRow } = require('./sheets.js');

require('dotenv').config(); // Load environment variables

const app = express();
app.use(cors());
app.use(express.json()); // ✅ only this


// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '/')));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
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
      const { name, email } = event.payload.subscription.entity.notes;
      const subscription_id = event.payload.subscription.entity.id;
      console.log('Subscription payment successful:', { name, email, subscription_id });

      // Add subscriber to Google Sheets on successful payment
      try {
        await addRow(name, email, subscription_id);
      } catch (sheetError) {
        console.error('Failed to add to Google Sheets:', sheetError.message);
      }
    }

    if (event.event === 'subscription.cancelled') {
      const subscription_id = event.payload.subscription.entity.id;
      console.log('Subscription cancelled:', subscription_id);
      
      // Remove subscriber from Google Sheets
      try {
        await removeRow(subscription_id);
      } catch (sheetError) {
        console.error('Failed to remove from Google Sheets:', sheetError.message);
        // Log the error, as the webhook must return 200 OK
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('error');
    
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
