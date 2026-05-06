const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

router.get('/', async (req, res) => {
  try {
    const { from, to, today, thisMonth, category, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false };
    if (category) filter.category = category;
    if (today) {
      filter.date = { $gte: moment().tz(IST).startOf('day').toDate(), $lte: moment().tz(IST).endOf('day').toDate() };
    } else if (thisMonth) {
      filter.date = { $gte: moment().tz(IST).startOf('month').toDate(), $lte: moment().tz(IST).endOf('month').toDate() };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
    }
    const total = await Expense.countDocuments(filter);
    const expenses = await Expense.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    const totalAmount = await Expense.aggregate([
      { $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const byCategory = await Expense.aggregate([
      { $match: filter }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    res.json({ expenses, total, totalAmount: totalAmount[0]?.total || 0, byCategory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, category, description, amount, paymentMode } = req.body;
    if (!category || !description || !amount) return res.status(400).json({ error: 'Missing required fields' });
    const expense = new Expense({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      category, description, amount, paymentMode: paymentMode || 'Cash'
    });
    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await Expense.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    existing.editHistory.push({ changes: existing.toObject(), editedAt: new Date() });
    const { date, category, description, amount, paymentMode } = req.body;
    Object.assign(existing, {
      date: date ? moment.tz(date, IST).toDate() : existing.date,
      category, description, amount, paymentMode: paymentMode || existing.paymentMode
    });
    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense || expense.isDeleted) return res.status(404).json({ error: 'Not found' });
    expense.isDeleted = true;
    expense.deletedAt = new Date();
    await expense.save();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
