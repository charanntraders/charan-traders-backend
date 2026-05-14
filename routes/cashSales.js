const express = require('express');
const router = express.Router();
const CashSale = require('../models/CashSale');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

function getDateFilter(from, to, today, thisMonth) {
  const filter = {};
  if (today) {
    filter.date = { $gte: moment().tz(IST).startOf('day').toDate(), $lte: moment().tz(IST).endOf('day').toDate() };
  } else if (thisMonth) {
    filter.date = { $gte: moment().tz(IST).startOf('month').toDate(), $lte: moment().tz(IST).endOf('month').toDate() };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
    if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
  }
  return filter;
}

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
    const sales = await CashSale.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    const totalAmount = await CashSale.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit), totalAmount: totalAmount[0]?.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { date, customerName, materialName, quantity, unit, rate, amount, paymentMode, notes, items, loading, rent } = req.body;
    if (!materialName || !quantity || !rate || !paymentMode) return res.status(400).json({ error: 'Missing required fields' });
    const itemsTotal = items && items.length > 0 ? items.reduce((s, i) => s + (i.amount || 0), 0) : quantity * rate;
    const calculatedAmount = itemsTotal + (loading || 0) + (rent || 0);
    if (Math.abs(calculatedAmount - amount) > 1) return res.status(400).json({ error: 'Amount mismatch' });
    const sale = new CashSale({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      customerName: customerName || 'Walk-in Customer',
      materialName, quantity, unit: unit || 'kg', rate, amount, paymentMode, notes,
      items: items || [],
      loading: loading || 0,
      rent: rent || 0
    });
    await sale.save();
    res.status(201).json(sale);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await CashSale.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    const oldData = existing.toObject();
    const { date, customerName, materialName, quantity, unit, rate, amount, paymentMode, notes, items, loading, rent } = req.body;
    const itemsTotal = items && items.length > 0 ? items.reduce((s, i) => s + (i.amount || 0), 0) : quantity * rate;
    const calculatedAmount = itemsTotal + (loading || 0) + (rent || 0);
    if (Math.abs(calculatedAmount - amount) > 1) return res.status(400).json({ error: 'Amount mismatch' });
    existing.editHistory.push({ changes: oldData, editedAt: new Date() });
    Object.assign(existing, {
      date: date ? moment.tz(date, IST).toDate() : existing.date,
      customerName: customerName || existing.customerName,
      materialName, quantity, unit: unit || existing.unit,
      rate, amount, paymentMode: paymentMode || existing.paymentMode, notes,
      items: items || existing.items,
      loading: loading || 0,
      rent: rent || 0
    });
    await existing.save();
    res.json(existing);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const sale = await CashSale.findById(req.params.id);
    if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Not found' });
    sale.isDeleted = true;
    sale.deletedAt = new Date();
    await sale.save();
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const { from, to, today, thisMonth } = req.query;
    const filter = { isDeleted: false, ...getDateFilter(from, to, today, thisMonth) };
    const stats = await CashSale.aggregate([{ $match: filter }, { $group: { _id: '$paymentMode', total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    const overall = await CashSale.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    res.json({ byMode: stats, overall: overall[0] || { total: 0, count: 0 } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
