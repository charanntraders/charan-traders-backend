const mongoose = require('mongoose');

const cashSaleSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  customerName: { type: String, default: 'Walk-in Customer', trim: true },
  materialName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'kg', trim: true },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, enum: ['Cash', 'UPI', 'Bank'], required: true },
  notes: { type: String, trim: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed },
    editedBy: { type: String, default: 'admin' }
  }]
}, { timestamps: true });

cashSaleSchema.index({ date: -1 });
cashSaleSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('CashSale', cashSaleSchema);
