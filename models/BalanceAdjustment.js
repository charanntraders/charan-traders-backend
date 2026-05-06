const mongoose = require('mongoose');

const balanceAdjustmentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  partyName: { type: String, required: true, trim: true },
  partyType: { type: String, enum: ['customer', 'vendor'], required: true },
  adjustmentType: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BalanceAdjustment', balanceAdjustmentSchema);
