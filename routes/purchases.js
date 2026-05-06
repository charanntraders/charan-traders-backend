const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Party = require('../models/Party');
const { calculateVendorLedger, getVendorBalance } = require('../utils/ledger');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

router.get('/', async (req, res) => {
  try {
    const { from, to, today, thisMonth, search, vendorName, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false };
    if (vendorName) filter.vendorName = vendorName;
    if (search) {
      filter.$or = [
        { vendorName: { $regex: search, $options: 'i' } },
        { materialName: { $regex: search, $options: 'i' } }
      ];
    }
    if (today) {
      filter.date = { $gte: moment().tz(IST).startOf('day').toDate(), $lte: moment().tz(IST).endOf('day').toDate() };
    } else if (thisMonth) {
      filter.date = { $gte: moment().tz(IST).startOf('month').toDate(), $lte: moment().tz(IST).endOf('month').toDate() };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
    }
    const total = await Purchase.countDocuments(filter);
    const purchases = await Purchase.find(filter)
      .sort({ date: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    const totalAmount = await Purchase.aggregate([
      { $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    res.json({ purchases, total, totalAmount: totalAmount[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ledger/:vendorName', async (req, res) => {
  try {
    const { from, to } = req.query;
    const ledger = await calculateVendorLedger(decodeURIComponent(req.params.vendorName), from, to);
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, vendorName, materialName, quantity, unit, rate, amount, invoiceNumber, notes } = req.body;
    if (!vendorName || !materialName || !quantity || !rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const calculatedAmount = quantity * rate;
    if (Math.abs(calculatedAmount - amount) > 0.01) return res.status(400).json({ error: 'Amount mismatch' });
    await Party.findOneAndUpdate({ name: vendorName }, { name: vendorName, type: 'vendor' }, { upsert: true, new: true });
    const purchase = new Purchase({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      vendorName, materialName, quantity, unit: unit || 'kg', rate, amount, invoiceNumber, notes
    });
    await purchase.save();
    const currentBalance = await getVendorBalance(vendorName);
    res.status(201).json({ purchase, currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await Purchase.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    existing.editHistory.push({ changes: existing.toObject(), editedAt: new Date() });
    const { date, vendorName, materialName, quantity, unit, rate, amount, invoiceNumber, notes } = req.body;
    const calculatedAmount = quantity * rate;
    if (Math.abs(calculatedAmount - amount) > 0.01) return res.status(400).json({ error: 'Amount mismatch' });
    Object.assign(existing, {
      date: date ? moment.tz(date, IST).toDate() : existing.date,
      vendorName: vendorName || existing.vendorName,
      materialName, quantity, unit: unit || existing.unit, rate, amount, invoiceNumber, notes
    });
    await existing.save();
    const currentBalance = await getVendorBalance(existing.vendorName);
    res.json({ purchase: existing, currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase || purchase.isDeleted) return res.status(404).json({ error: 'Not found' });
    purchase.isDeleted = true;
    purchase.deletedAt = new Date();
    await purchase.save();
    const currentBalance = await getVendorBalance(purchase.vendorName);
    res.json({ message: 'Deleted', currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
