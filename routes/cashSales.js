const express = require('express');
const router = express.Router();
const CashSale = require('../models/CashSale');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

function getDateFilter(from, to, today, thisMonth) {
  const filter = {};
  if (today) {
    const startOfDay = moment().tz(IST).startOf('day').toDate();
    const endOfDay = moment().tz(IST).endOf('day').toDate();
    filter.date = { $gte: startOfDay, $lte: endOfDay };
  } else if (thisMonth) {
    const startOfMonth = moment().tz(IST).startOf('month').toDate();
    const endOfMonth = moment().tz(IST).endOf('month').toDate();
    filter.date = { $gte: startOfMonth, $lte: endOfMonth };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
    if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
  }
  return filter;
}

// GET all cash sales
router.get('/', async (req, res) => {
  try {
    const { from, to, today, thisMonth, search, paymentMode, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false, ...getDateFilter(from, to, today, thisMonth) };
    if (paymentMode) filter.paymentMode = paymentMode;
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { materialName: { $regex: search, $options: 'i' } }
      ];
    }
    const total = await CashSale.countDocuments(filter);
    const sales = await CashSale.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    
    const totalAmount = await CashSale.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({ 
      sales, 
      total, 
      page: Number(page), 
      pages: Math.ceil(total / limit),
      totalAmount: totalAmount[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create cash sale
router.post('/', async (req, res) => {
  try {
    const { date, customerName, materialName, quantity, unit, rate, amount, paymentMode, notes } = req.body;
    if (!materialName || !quantity || !rate || !paymentMode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const calculatedAmount = quantity * rate;
    if (Math.abs(calculatedAmount - amount) > 0.01) {
      return res.status(400).json({ error: 'Amount mismatch: quantity × rate ≠ amount' });
    }
    const sale = new CashSale({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      customerName: customerName || 'Walk-in Customer',
      materialName, quantity, unit: unit || 'kg', rate, amount, paymentMode, notes
    });
    await sale.save();
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update cash sale
router.put('/:id', async (req, res) => {
  try {
    const existing = await CashSale.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    
    const oldData = existing.toObject();
    const { date, customerName, materialName, quantity, unit, rate, amount, paymentMode, notes } = req.body;
    const calculatedAmount = quantity * rate;
    if (Math.abs(calculatedAmount - amount) > 0.01) {
      return res.status(400).json({ error: 'Amount mismatch' });
    }
    
    existing.editHistory.push({ changes: oldData, editedAt: new Date() });
    existing.date = date ? moment.tz(date, IST).toDate() : existing.date;
    existing.customerName = customerName || existing.customerName;
    existing.materialName = materialName || existing.materialName;
    existing.quantity = quantity;
    existing.unit = unit || existing.unit;
    existing.rate = rate;
    existing.amount = amount;
    existing.paymentMode = paymentMode || existing.paymentMode;
    existing.notes = notes;
    
    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE soft delete
router.delete('/:id', async (req, res) => {
  try {
    const sale = await CashSale.findById(req.params.id);
    if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Not found' });
    sale.isDeleted = true;
    sale.deletedAt = new Date();
    await sale.save();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET summary stats
router.get('/stats/summary', async (req, res) => {
  try {
    const { from, to, today, thisMonth } = req.query;
    const filter = { isDeleted: false, ...getDateFilter(from, to, today, thisMonth) };
    const stats = await CashSale.aggregate([
      { $match: filter },
      { $group: {
        _id: '$paymentMode',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);
    const overall = await CashSale.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    res.json({ byMode: stats, overall: overall[0] || { total: 0, count: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
