const mongoose = require('mongoose');

const vendorPaymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  vendorName: { type: String, required: true, trim: true },
  amountPaid: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, enum: ['Cash', 'UPI', 'Bank', 'Cheque'], required: true },
  reference: { type: String, trim: true },
  notes: { type: String, trim: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed }
  }]
}, { timestamps: true });

vendorPaymentSchema.index({ vendorName: 1, date: -1 });

module.exports = mongoose.model('VendorPayment', vendorPaymentSchema);
