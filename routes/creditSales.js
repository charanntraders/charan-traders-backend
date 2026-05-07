const express = require('express');
const router = express.Router();
const CreditSale = require('../models/CreditSale');
const Party = require('../models/Party');
const { calculateCustomerLedger, getCustomerBalance } = require('../utils/ledger');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

// GET all credit sales
router.get('/', async (req, res) => {
  try {
    const { from, to, today, thisMonth, search, partyName, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false };
    if (partyName) filter.partyName = partyName;
    if (search) {
      filter.$or = [
        { partyName: { $regex: search, $options: 'i' } },
        { materialName: { $regex: search, $options: 'i' } }
      ];
    }
    if (today) {
      const s = moment().tz(IST).startOf('day').toDate();
      const e = moment().tz(IST).endOf('day').toDate();
      filter.date = { $gte: s, $lte: e };
    } else if (thisMonth) {
      const s = moment().tz(IST).startOf('month').toDate();
      const e = moment().tz(IST).endOf('month').toDate();
      filter.date = { $gte: s, $lte: e };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
    }
    const total = await CreditSale.countDocuments(filter);
    const sales = await CreditSale.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const totalAmount = await CreditSale.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit), totalAmount: totalAmount[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ledger for specific party
router.get('/ledger/:partyName', async (req, res) => {
  try {
    const { from, to } = req.query;
    const ledger = await calculateCustomerLedger(decodeURIComponent(req.params.partyName), from, to);
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET balance for party (for old due display)
router.get('/balance/:partyName', async (req, res) => {
  try {
    const balance = await getCustomerBalance(decodeURIComponent(req.params.partyName));
    res.json({ partyName: req.params.partyName, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all party names with outstanding dues
router.get('/outstanding', async (req, res) => {
  try {
    const parties = await CreditSale.distinct('partyName', { isDeleted: false });
    const balances = await Promise.all(
      parties.map(async name => {
        const balance = await getCustomerBalance(name);
        return { partyName: name, balance };
      })
    );
    res.json(balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create credit sale
router.post('/', async (req, res) => {
  try {
    const { date, partyName, materialName, quantity, unit, rate, amount, notes, items, loading, transport } = req.body;
    if (!partyName || !materialName || !quantity || !rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
   const itemsTotal = items && items.length > 0
  ? items.reduce((s, i) => s + (i.amount || 0), 0)
  : quantity * rate;
const calculatedAmount = itemsTotal + (loading || 0) + (rent || 0);
if (Math.abs(calculatedAmount - amount) > 1) {
  return res.status(400).json({ error: 'Amount mismatch' });
}
    // Auto-create party if not exists
    await Party.findOneAndUpdate(
      { name: partyName },
      { name: partyName, type: 'customer' },
      { upsert: true, new: true }
    );
    const sale = new CreditSale({
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      partyName, materialName, quantity, unit: unit || 'kg', rate, amount, notes,
      items: items || [],
      loading: loading || 0,
      transport: transport || 0
    });
    await sale.save();
    const currentBalance = await getCustomerBalance(partyName);
    res.status(201).json({ sale, currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update credit sale
router.put('/:id', async (req, res) => {
  try {
    const existing = await CreditSale.findById(req.params.id);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Not found' });
    const oldData = existing.toObject();
    const { date, partyName, materialName, quantity, unit, rate, amount, notes } = req.body;
    const calculatedAmount = quantity * rate;
    if (Math.abs(calculatedAmount - amount) > 0.01) return res.status(400).json({ error: 'Amount mismatch' });
    existing.editHistory.push({ changes: oldData, editedAt: new Date() });
    Object.assign(existing, {
      date: date ? moment.tz(date, IST).toDate() : existing.date,
      partyName: partyName || existing.partyName,
      materialName, quantity, unit: unit || existing.unit, rate, amount, notes
    });
    await existing.save();
    const currentBalance = await getCustomerBalance(existing.partyName);
    res.json({ sale: existing, currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE soft delete
router.delete('/:id', async (req, res) => {
  try {
    const sale = await CreditSale.findById(req.params.id);
    if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Not found' });
    sale.isDeleted = true;
    sale.deletedAt = new Date();
    await sale.save();
    const currentBalance = await getCustomerBalance(sale.partyName);
    res.json({ message: 'Deleted', currentBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
