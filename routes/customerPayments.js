const express = require('express');
const router = express.Router();
const CustomerPayment = require('../models/CustomerPayment');
const { getCustomerBalance } = require('../utils/ledger');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

router.get('/', async (req, res) => {
  try {
    const { from, to, partyName, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false };
    if (partyName) filter.partyName = partyName;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
    }
    const total = await CustomerPayment.countDocuments(filter);
    const payments = await CustomerPayment.find(filter)
      .sort({ date: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    res.json({ payments, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, partyName, amountReceived, paymentMode, reference, notes } = req.body;
    if (!partyName || !amountReceived || !paymentMode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const currentBalance = await getCustomerBalance(partyName);
    if (amountReceived > currentBalance + 0.01) {
      // Allow overpayment but warn
    }
    const payment = new CustomerPayment({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      partyName, amountReceived, paymentMode, reference, notes
    });
    await payment.save();
    const newBalance = await getCustomerBalance(partyName);
    res.status(201).json({ payment, newBalance, previousBalance: currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await CustomerPayment.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    existing.editHistory.push({ changes: existing.toObject(), editedAt: new Date() });
    const { date, partyName, amountReceived, paymentMode, reference, notes } = req.body;
    Object.assign(existing, {
      date: date ? moment.tz(date, IST).toDate() : existing.date,
      partyName: partyName || existing.partyName,
      amountReceived, paymentMode, reference, notes
    });
    await existing.save();
    const newBalance = await getCustomerBalance(existing.partyName);
    res.json({ payment: existing, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const payment = await CustomerPayment.findById(req.params.id);
    if (!payment || payment.isDeleted) return res.status(404).json({ error: 'Not found' });
    payment.isDeleted = true;
    payment.deletedAt = new Date();
    await payment.save();
    const newBalance = await getCustomerBalance(payment.partyName);
    res.json({ message: 'Deleted', newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
