import "dotenv/config";
import express from "express";
import crypto from "crypto";
import amqp from "amqplib";
import { stat } from "fs";

const app = express();
app.use(express.json());

const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_SECRET || "eqoAPlGUy4pzKTI3btotf4HZ";
const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const QUEUE = "payment.success";

// RabbitMQ connection pool (optional for performance)
let rabbitConn, rabbitChannel;

async function initRabbit() {
  try {
    rabbitConn = await amqp.connect(RABBITMQ_URL);
    rabbitChannel = await rabbitConn.createChannel();
    await rabbitChannel.assertQueue(QUEUE, { durable: true });
    console.log("Connected to RabbitMQ");
  } catch (err) {
    console.error("RabbitMQ connection failed:", err);
  }
}

async function publishToRabbitMQ(message) {
  try {
    if (!rabbitChannel) await initRabbit();
    rabbitChannel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  } catch (err) {
    console.error("RabbitMQ publish error:", err);
  }
}

app.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error(" Invalid webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }
  console.log("Received webhook event:", req.body.event, "boddy:", req.body);
  console.log("payload----from payment gatway-----------:", req.body.payload);
  // Only handle payment captured
  if (
    req.body.event === "payment.captured" ||
    req.body.event === "payment.failed"
  ) {
    const payload = req.body.payload.payment.entity;
    console.log("payload----from payment gatway-----------:", payload);
    const message = {
      paymentId: payload.id,
      orderId: payload.order_id,
      amount: payload.amount / 100,
      userId: payload.notes?.userId,
      rechargePackId: payload.notes?.rechargePackId,
      coins: Number(payload.notes?.coins),
      serviceType: payload.notes?.serviceType || "RECHARGE",
      status: req.body.event === "payment.captured" ? "captured" : "failed",
      couponCode: payload.notes?.couponCode || null,
      couponType: payload.notes?.type || "NORMAL",
      discount: payload.notes?.discount ? Number(payload.notes.discount) : 0,
      cashback: payload.notes?.cashback ? Number(payload.notes.cashback) : 0,
      country: payload.notes?.country,
      state: payload.notes?.state,
      city: payload.notes?.city,
      platform:payload.notes?.platform
    };

    console.log("Webhook Payload Message:", message);
    await publishToRabbitMQ({
      paymentId: payload.id,
      orderId: payload.order_id,
      amount: payload.amount / 100,
      userId: payload.notes?.userId,
      rechargePackId: payload.notes?.rechargePackId,
      coins: Number(payload.notes?.coins),
      serviceType: payload.notes?.serviceType || "RECHARGE",
      status: req.body.event === "payment.captured" ? "captured" : "failed",
      couponCode: payload.notes?.couponCode || null,
      couponType: payload.notes?.type || "NORMAL",
      discount: payload.notes?.discount ? Number(payload.notes.discount) : 0,
      cashback: payload.notes?.cashback ? Number(payload.notes.cashback) : 0,
      country: payload.notes?.country,
      state: payload.notes?.state,
      city: payload.notes?.city,
      platform:payload.notes?.platform
    });
    console.log(`Processed ${req.body.event}: ${payload.id}`);
  }

  res.json({ status: "ok" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 8004;
app.listen(PORT, () => console.log(`Webhook server running on port ${PORT}`));
