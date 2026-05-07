const express = require('express');
const router = express.Router();
const Party = require('../models/Party');
const { getCustomerBalance, getVendorBalance } = require('../utils/ledger');

router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = { isDeleted: false };
    if (type) filter.type = { $in: [type, 'both'] };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const parties = await Party.find(filter).sort({ name: 1 }).lean();
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers-with-balance', async (req, res) => {
  try {
    const parties = await Party.find({ isDeleted: false, type: { $in: ['customer', 'both'] } }).lean();
    const withBalances = await Promise.all(
      parties.map(async p => ({
        ...p,
        balance: await getCustomerBalance(p.name)
      }))
    );
    res.json(withBalances.sort((a, b) => b.balance - a.balance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vendors-with-balance', async (req, res) => {
  try {
    const parties = await Party.find({ isDeleted: false, type: { $in: ['vendor', 'both'] } }).lean();
    const withBalances = await Promise.all(
      parties.map(async p => ({
        ...p,
        balance: await getVendorBalance(p.name)
      }))
    );
    res.json(withBalances.sort((a, b) => b.balance - a.balance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, phone, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const party = await Party.findOneAndUpdate(
      { name },
      { name, type: type || 'customer', phone, address },
      { upsert: true, new: true }
    );
    res.json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Balance adjustment
router.post('/adjust-balance', async (req, res) => {
  try {
    const BalanceAdjustment = require('../models/BalanceAdjustment');
    const moment = require('moment-timezone');
    const { partyName, partyType, adjustmentType, amount, reason, date } = req.body;
    if (!partyName || !partyType || !adjustmentType || !amount || !reason) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const adj = new BalanceAdjustment({
      date: date ? moment.tz(date, 'Asia/Kolkata').toDate() : new Date(),
      partyName, partyType, adjustmentType, amount, reason
    });
    await adj.save();
    let newBalance;
    if (partyType === 'customer') newBalance = await getCustomerBalance(partyName);
    else newBalance = await getVendorBalance(partyName);
    res.status(201).json({ adjustment: adj, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);
    if (!party) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
