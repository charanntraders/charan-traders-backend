const express = require('express');
const router = express.Router();
const CashSale = require('../models/CashSale');
const CreditSale = require('../models/CreditSale');
const CustomerPayment = require('../models/CustomerPayment');
const Purchase = require('../models/Purchase');
const VendorPayment = require('../models/VendorPayment');
const Expense = require('../models/Expense');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

router.get('/', async (req, res) => {
  try {
    const { from, to, today, thisMonth } = req.query;
    let dateFilter = {};
    
    if (today) {
      const s = moment().tz(IST).startOf('day').toDate();
      const e = moment().tz(IST).endOf('day').toDate();
      dateFilter = { $gte: s, $lte: e };
    } else if (thisMonth) {
      const s = moment().tz(IST).startOf('month').toDate();
      const e = moment().tz(IST).endOf('month').toDate();
      dateFilter = { $gte: s, $lte: e };
    } else if (from || to) {
      dateFilter = {};
      if (from) dateFilter.$gte = moment.tz(from, IST).startOf('day').toDate();
      if (to) dateFilter.$lte = moment.tz(to, IST).endOf('day').toDate();
    }

    const baseMatch = (field = 'date') => {
      const m = { isDeleted: false };
      if (Object.keys(dateFilter).length > 0) m[field] = dateFilter;
      return m;
    };

    const [
      cashSalesTotal, creditSalesTotal, expensesTotal,
      customerPaymentsTotal, purchasesTotal, vendorPaymentsTotal,
      allCreditSales, allCustomerPayments, allPurchases, allVendorPayments,
      recentCashSales, recentCreditSales, recentExpenses,
      cashByMode
    ] = await Promise.all([
      CashSale.aggregate([{ $match: baseMatch() }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      CreditSale.aggregate([{ $match: baseMatch() }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: baseMatch() }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      CustomerPayment.aggregate([{ $match: baseMatch() }, { $group: { _id: null, total: { $sum: '$amountReceived' } } }]),
      Purchase.aggregate([{ $match: baseMatch() }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      VendorPayment.aggregate([{ $match: baseMatch() }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
      CreditSale.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      CustomerPayment.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$amountReceived' } } }]),
      Purchase.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      VendorPayment.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
      CashSale.find({ isDeleted: false }).sort({ date: -1 }).limit(5).lean(),
      CreditSale.find({ isDeleted: false }).sort({ date: -1 }).limit(5).lean(),
      Expense.find({ isDeleted: false }).sort({ date: -1 }).limit(5).lean(),
      CashSale.aggregate([{ $match: baseMatch() }, { $group: { _id: '$paymentMode', total: { $sum: '$amount' } } }])
    ]);

    const totalReceivables = (allCreditSales[0]?.total || 0) - (allCustomerPayments[0]?.total || 0);
    const totalPayables = (allPurchases[0]?.total || 0) - (allVendorPayments[0]?.total || 0);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = moment().tz(IST).subtract(5, 'months').startOf('month').toDate();
    const monthlyTrend = await CashSale.aggregate([
      { $match: { isDeleted: false, date: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      summary: {
        cashSales: cashSalesTotal[0]?.total || 0,
        creditSales: creditSalesTotal[0]?.total || 0,
        totalSales: (cashSalesTotal[0]?.total || 0) + (creditSalesTotal[0]?.total || 0),
        totalReceivables: Math.max(0, totalReceivables),
        totalPayables: Math.max(0, totalPayables),
        expenses: expensesTotal[0]?.total || 0,
        purchases: purchasesTotal[0]?.total || 0,
        customerPayments: customerPaymentsTotal[0]?.total || 0,
        vendorPayments: vendorPaymentsTotal[0]?.total || 0,
      },
      cashByMode,
      monthlyTrend,
      recentActivity: {
        cashSales: recentCashSales,
        creditSales: recentCreditSales,
        expenses: recentExpenses
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
