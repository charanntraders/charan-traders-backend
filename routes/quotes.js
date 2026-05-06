const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

// TMT Steel weight per rod (kg) - Standard weights
const STANDARD_WEIGHTS = {
  Primegold: { '8mm': 4.6, '10mm': 7.0, '12mm': 10.1, '16mm': 18.5, '20mm': 28.1 },
  Meenakshi: { '8mm': 4.6, '10mm': 7.0, '12mm': 10.1, '16mm': 18.5, '20mm': 28.1 },
  // Indus, Vizag, Shyam, JSW use theoretical weights (standard formula: d²/162 × length)
  Indus:    { '8mm': 4.74, '10mm': 7.41, '12mm': 10.67, '16mm': 18.97, '20mm': 29.63 },
  Vizag:    { '8mm': 4.74, '10mm': 7.41, '12mm': 10.67, '16mm': 18.97, '20mm': 29.63 },
  Shyam:    { '8mm': 4.74, '10mm': 7.41, '12mm': 10.67, '16mm': 18.97, '20mm': 29.63 },
  JSW:      { '8mm': 4.74, '10mm': 7.41, '12mm': 10.67, '16mm': 18.97, '20mm': 29.63 }
};

router.get('/weights', (req, res) => {
  res.json(STANDARD_WEIGHTS);
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { isDeleted: false };
    if (status) filter.status = status;
    const total = await Quote.countDocuments(filter);
    const quotes = await Quote.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    res.json({ quotes, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id).lean();
    if (!quote) return res.status(404).json({ error: 'Not found' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate quote number
async function generateQuoteNumber() {
  const today = moment().tz(IST);
  const prefix = `QT-${today.format('YYYYMM')}-`;
  const lastQuote = await Quote.findOne({ quoteNumber: { $regex: `^${prefix}` } }).sort({ quoteNumber: -1 });
  let seq = 1;
  if (lastQuote) {
    const parts = lastQuote.quoteNumber.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

router.post('/', async (req, res) => {
  try {
    const { date, customerName, customerPhone, customerAddress, items, validityDays, notes } = req.body;
    if (!customerName || !items || !items.length) return res.status(400).json({ error: 'Missing required fields' });
    
    const processedItems = items.map(item => ({
      brand: 'General',
      description: item.description || item.brand || 'Item',
      size: item.unit || 'piece',
      numberOfRods: parseFloat(item.quantity) || item.numberOfRods || 1,
      weightPerRod: 1,
      totalWeight: parseFloat(item.quantity) || item.numberOfRods || 1,
      ratePerKg: parseFloat(item.rate) || item.ratePerKg || 0,
      amount: (parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0),
      unit: item.unit || 'piece'
}));
    
    const totalWeight = processedItems.reduce((sum, i) => sum + i.totalWeight, 0);
    const totalAmount = processedItems.reduce((sum, i) => sum + i.amount, 0);
    const quoteNumber = await generateQuoteNumber();

    const quote = new Quote({
      quoteNumber,
      date: date ? moment.tz(date, IST).toDate() : moment().tz(IST).toDate(),
      customerName, customerPhone, customerAddress,
      items: processedItems,
      totalAmount, totalWeight,
      validityDays: validityDays || 7, notes
    });
    await quote.save();
    res.status(201).json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote || quote.isDeleted) return res.status(404).json({ error: 'Not found' });
    const { items, ...rest } = req.body;
    const processedItems = items?.map(item => ({
      ...item,
      totalWeight: item.numberOfRods * item.weightPerRod,
      amount: item.numberOfRods * item.weightPerRod * item.ratePerKg
    }));
    Object.assign(quote, rest);
    if (processedItems) {
      quote.items = processedItems;
      quote.totalWeight = processedItems.reduce((sum, i) => sum + i.totalWeight, 0);
      quote.totalAmount = processedItems.reduce((sum, i) => sum + i.amount, 0);
    }
    await quote.save();
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    quote.isDeleted = true;
    await quote.save();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
