const express = require('express');
const router = express.Router();
const CashSale = require('../models/CashSale');
const CreditSale = require('../models/CreditSale');
const CustomerPayment = require('../models/CustomerPayment');
const Purchase = require('../models/Purchase');
const VendorPayment = require('../models/VendorPayment');
const Expense = require('../models/Expense');
const Party = require('../models/Party');
const Quote = require('../models/Quote');
const moment = require('moment-timezone');

// Export full database as JSON
router.get('/export', async (req, res) => {
  try {
    const [cashSales, creditSales, customerPayments, purchases, vendorPayments, expenses, parties, quotes] = await Promise.all([
      CashSale.find({}).lean(),
      CreditSale.find({}).lean(),
      CustomerPayment.find({}).lean(),
      Purchase.find({}).lean(),
      VendorPayment.find({}).lean(),
      Expense.find({}).lean(),
      Party.find({}).lean(),
      Quote.find({}).lean()
    ]);
    const backup = {
      exportedAt: new Date().toISOString(),
      exportedAtIST: moment().tz('Asia/Kolkata').format('DD/MM/YYYY HH:mm:ss'),
      version: '1.0',
      data: { cashSales, creditSales, customerPayments, purchases, vendorPayments, expenses, parties, quotes }
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="charan-traders-backup-${moment().tz('Asia/Kolkata').format('YYYY-MM-DD')}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import / restore from JSON
router.post('/import', async (req, res) => {
  try {
    const { data, mode = 'merge' } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    const results = {};
    
    if (mode === 'replace') {
      // Clear existing data before import
      await Promise.all([
        CashSale.deleteMany({}),
        CreditSale.deleteMany({}),
        CustomerPayment.deleteMany({}),
        Purchase.deleteMany({}),
        VendorPayment.deleteMany({}),
        Expense.deleteMany({}),
        Party.deleteMany({}),
        Quote.deleteMany({})
      ]);
    }

    const importCollection = async (Model, records, name) => {
      if (!records || !records.length) return 0;
      let count = 0;
      for (const record of records) {
        try {
          const { _id, __v, ...rest } = record;
          await Model.findByIdAndUpdate(_id, rest, { upsert: true, new: true });
          count++;
        } catch (e) { /* skip duplicates */ }
      }
      results[name] = count;
      return count;
    };

    await Promise.all([
      importCollection(CashSale, data.cashSales, 'cashSales'),
      importCollection(CreditSale, data.creditSales, 'creditSales'),
      importCollection(CustomerPayment, data.customerPayments, 'customerPayments'),
      importCollection(Purchase, data.purchases, 'purchases'),
      importCollection(VendorPayment, data.vendorPayments, 'vendorPayments'),
      importCollection(Expense, data.expenses, 'expenses'),
      importCollection(Party, data.parties, 'parties'),
      importCollection(Quote, data.quotes, 'quotes')
    ]);

    res.json({ message: 'Import successful', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
