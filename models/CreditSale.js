const mongoose = require('mongoose');

const creditSaleSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  partyName: { type: String, required: true, trim: true },
  materialName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'kg', trim: true },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed }
  }]
}, { timestamps: true });

creditSaleSchema.index({ partyName: 1, date: -1 });
creditSaleSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('CreditSale', creditSaleSchema);
