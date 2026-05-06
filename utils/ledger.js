const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';

/**
 * Calculate customer ledger with running balance sorted chronologically by date
 */
async function calculateCustomerLedger(partyName, fromDate = null, toDate = null) {
  const CreditSale = require('../models/CreditSale');
  const CustomerPayment = require('../models/CustomerPayment');
  const BalanceAdjustment = require('../models/BalanceAdjustment');

  const dateFilter = { partyName, isDeleted: false };
  if (fromDate || toDate) {
    dateFilter.date = {};
    if (fromDate) dateFilter.date.$gte = new Date(fromDate);
    if (toDate) dateFilter.date.$lte = new Date(toDate);
  }

  const [sales, payments, adjustments] = await Promise.all([
    CreditSale.find(dateFilter).lean(),
    CustomerPayment.find(dateFilter).lean(),
    BalanceAdjustment.find({ ...dateFilter, partyType: 'customer' }).lean()
  ]);

  // Combine all entries with type tags
  const entries = [
    ...sales.map(s => ({ ...s, entryType: 'sale', debit: s.amount, credit: 0 })),
    ...payments.map(p => ({ ...p, entryType: 'payment', debit: 0, credit: p.amountReceived })),
    ...adjustments.map(a => ({
      ...a, entryType: 'adjustment',
      debit: a.adjustmentType === 'debit' ? a.amount : 0,
      credit: a.adjustmentType === 'credit' ? a.amount : 0
    }))
  ];

  // Sort chronologically by date, then by createdAt for same-date entries
  entries.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA - dateB !== 0) return dateA - dateB;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  // Calculate running balance
  let runningBalance = 0;
  const ledgerEntries = entries.map(entry => {
    runningBalance += entry.debit - entry.credit;
    return {
      ...entry,
      runningBalance,
      formattedDate: moment(entry.date).tz(IST).format('DD/MM/YYYY')
    };
  });

  const totalDue = runningBalance;
  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
  const totalReceived = payments.reduce((sum, p) => sum + p.amountReceived, 0);

  return {
    partyName,
    ledgerEntries,
    totalSales,
    totalReceived,
    totalDue,
    isOverdue: totalDue > 0
  };
}

/**
 * Calculate vendor ledger with running balance
 */
async function calculateVendorLedger(vendorName, fromDate = null, toDate = null) {
  const Purchase = require('../models/Purchase');
  const VendorPayment = require('../models/VendorPayment');
  const BalanceAdjustment = require('../models/BalanceAdjustment');

  const dateFilter = { vendorName, isDeleted: false };
  if (fromDate || toDate) {
    dateFilter.date = {};
    if (fromDate) dateFilter.date.$gte = new Date(fromDate);
    if (toDate) dateFilter.date.$lte = new Date(toDate);
  }

  const paymentFilter = { partyName: vendorName, isDeleted: false };
  if (fromDate || toDate) {
    paymentFilter.date = {};
    if (fromDate) paymentFilter.date.$gte = new Date(fromDate);
    if (toDate) paymentFilter.date.$lte = new Date(toDate);
  }

  const [purchases, payments, adjustments] = await Promise.all([
    Purchase.find(dateFilter).lean(),
    VendorPayment.find(paymentFilter).lean(),
    BalanceAdjustment.find({ partyName: vendorName, partyType: 'vendor', isDeleted: false }).lean()
  ]);

  const entries = [
    ...purchases.map(p => ({ ...p, entryType: 'purchase', debit: p.amount, credit: 0 })),
    ...payments.map(p => ({ ...p, entryType: 'payment', debit: 0, credit: p.amountPaid })),
    ...adjustments.map(a => ({
      ...a, entryType: 'adjustment',
      debit: a.adjustmentType === 'debit' ? a.amount : 0,
      credit: a.adjustmentType === 'credit' ? a.amount : 0
    }))
  ];

  entries.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA - dateB !== 0) return dateA - dateB;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  let runningBalance = 0;
  const ledgerEntries = entries.map(entry => {
    runningBalance += entry.debit - entry.credit;
    return {
      ...entry,
      runningBalance,
      formattedDate: moment(entry.date).tz(IST).format('DD/MM/YYYY')
    };
  });

  const totalPayable = runningBalance;
  const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);

  return {
    vendorName,
    ledgerEntries,
    totalPurchases,
    totalPaid,
    totalPayable,
    isOverdue: totalPayable > 0
  };
}

/**
 * Get current balance for a customer (due amount)
 */
async function getCustomerBalance(partyName) {
  const ledger = await calculateCustomerLedger(partyName);
  return ledger.totalDue;
}

/**
 * Get current balance for a vendor (payable amount)
 */
async function getVendorBalance(vendorName) {
  const ledger = await calculateVendorLedger(vendorName);
  return ledger.totalPayable;
}

module.exports = {
  calculateCustomerLedger,
  calculateVendorLedger,
  getCustomerBalance,
  getVendorBalance
};
