import fetch from 'node-fetch';
import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:8004/webhook';
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'eqoAPlGUy4pzKTI3btotf4HZ'; // must match RAZORPAY_WEBHOOK_SECRET in .env

const body = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_test_123",
        order_id: "order_test_456",
        amount: 5000, // in paise
        notes: {
          userId: "test-user-1",
          rechargePackId: "pack_001",
          coins: 100
        }
      }
    }
  }
};

// generate signature exactly as webhook does
const signature = crypto
  .createHmac('sha256', SECRET)
  .update(JSON.stringify(body))
  .digest('hex');

(async () => {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log('Webhook response:', data);
})();