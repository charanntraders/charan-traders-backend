const express = require('express');
const router = express.Router();
const { generateCustomerLedgerPDF, generateQuotePDF, generateSalesReportPDF } = require('../utils/pdfGenerator');
const { calculateCustomerLedger, calculateVendorLedger } = require('../utils/ledger');
const CashSale = require('../models/CashSale');
const CreditSale = require('../models/CreditSale');
const Quote = require('../models/Quote');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

router.get('/customer-ledger/:partyName', async (req, res) => {
  try {
    const { from, to } = req.query;
    const partyName = decodeURIComponent(req.params.partyName);
    const ledger = await calculateCustomerLedger(partyName, from, to);
    const dateRange = from && to ? { from, to } : null;
    const pdfBuffer = await generateCustomerLedgerPDF(ledger, dateRange);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-${partyName.replace(/\s/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vendor-ledger/:vendorName', async (req, res) => {
  try {
    const { from, to } = req.query;
    const vendorName = decodeURIComponent(req.params.vendorName);
    const ledger = await calculateVendorLedger(vendorName, from, to);
    const dateRange = from && to ? { from, to } : null;
    const pdfBuffer = await generateCustomerLedgerPDF({ ...ledger, partyName: vendorName }, dateRange);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vendor-ledger-${vendorName.replace(/\s/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cash-sales', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { isDeleted: false };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) filter.date.$lte = moment.tz(to, IST).endOf('day').toDate();
    }
    const entries = await CashSale.find(filter).sort({ date: 1 }).lean();
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const pdfBuffer = await generateSalesReportPDF({ entries, total }, from && to ? { from, to } : null, 'cash');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="cash-sales-report.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/quote/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id).lean();
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    const pdfBuffer = await generateQuotePDF(quote);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
