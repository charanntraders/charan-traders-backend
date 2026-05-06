const express = require('express');
const router = express.Router();
const CashSale = require('../models/CashSale');
const CreditSale = require('../models/CreditSale');
const CustomerPayment = require('../models/CustomerPayment');
const Purchase = require('../models/Purchase');
const VendorPayment = require('../models/VendorPayment');
const Expense = require('../models/Expense');

const MODELS = { cashSale: CashSale, creditSale: CreditSale, customerPayment: CustomerPayment, purchase: Purchase, vendorPayment: VendorPayment, expense: Expense };

// Get all deleted items
router.get('/', async (req, res) => {
  try {
    const results = {};
    for (const [key, Model] of Object.entries(MODELS)) {
      results[key] = await Model.find({ isDeleted: true }).sort({ deletedAt: -1 }).limit(100).lean();
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore deleted item
router.post('/restore/:type/:id', async (req, res) => {
  try {
    const Model = MODELS[req.params.type];
    if (!Model) return res.status(400).json({ error: 'Invalid type' });
    const item = await Model.findByIdAndUpdate(
      req.params.id, 
      { isDeleted: false, $unset: { deletedAt: 1 } }, 
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Restored', item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete
router.delete('/permanent/:type/:id', async (req, res) => {
  try {
    const Model = MODELS[req.params.type];
    if (!Model) return res.status(400).json({ error: 'Invalid type' });
    await Model.findByIdAndDelete(req.params.id);
    res.json({ message: 'Permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Empty trash
router.delete('/empty', async (req, res) => {
  try {
    const results = {};
    for (const [key, Model] of Object.entries(MODELS)) {
      const r = await Model.deleteMany({ isDeleted: true });
      results[key] = r.deletedCount;
    }
    res.json({ message: 'Trash emptied', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
