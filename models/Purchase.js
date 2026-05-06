const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  vendorName: { type: String, required: true, trim: true },
  materialName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'kg', trim: true },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  invoiceNumber: { type: String, trim: true },
  notes: { type: String, trim: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed }
  }]
}, { timestamps: true });

purchaseSchema.index({ vendorName: 1, date: -1 });
purchaseSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
