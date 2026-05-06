const express = require('express');
const router = express.Router();
const VendorPayment = require('../models/VendorPayment');
const { getVendorBalance } = require('../utils/ledger');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

router.get('/', async (req, res) => {
  try {
    const { from, to, vendorName, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false };
    if (vendorName) filter.vendorName = vendorName;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
    }
    const total = await VendorPayment.countDocuments(filter);
    const payments = await VendorPayment.find(filter)
      .sort({ date: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    res.json({ payments, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, vendorName, amountPaid, paymentMode, reference, notes } = req.body;
    if (!vendorName || !amountPaid || !paymentMode) return res.status(400).json({ error: 'Missing required fields' });
    const previousBalance = await getVendorBalance(vendorName);
    const payment = new VendorPayment({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      vendorName, amountPaid, paymentMode, reference, notes
    });
    await payment.save();
    const newBalance = await getVendorBalance(vendorName);
    res.status(201).json({ payment, newBalance, previousBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await VendorPayment.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    existing.editHistory.push({ changes: existing.toObject(), editedAt: new Date() });
    const { date, vendorName, amountPaid, paymentMode, reference, notes } = req.body;
    Object.assign(existing, {
      date: date ? moment.tz(date, IST).toDate() : existing.date,
      vendorName: vendorName || existing.vendorName,
      amountPaid, paymentMode, reference, notes
    });
    await existing.save();
    const newBalance = await getVendorBalance(existing.vendorName);
    res.json({ payment: existing, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const payment = await VendorPayment.findById(req.params.id);
    if (!payment || payment.isDeleted) return res.status(404).json({ error: 'Not found' });
    payment.isDeleted = true;
    payment.deletedAt = new Date();
    await payment.save();
    const newBalance = await getVendorBalance(payment.vendorName);
    res.json({ message: 'Deleted', newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
