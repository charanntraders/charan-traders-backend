const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  brand: { 
    type: String, 
    required: true,
    enum: ['Primegold', 'Meenakshi', 'Indus', 'Vizag', 'Shyam', 'JSW','General']
  },
  size: { type: String, required: true },
  numberOfRods: { type: Number, required: true, min: 1 },
  weightPerRod: { type: Number, required: true, min: 0 },
  totalWeight: { type: Number, required: true, min: 0 },
  ratePerKg: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  isWeightManuallyEdited: { type: Boolean, default: false }
});

const quoteSchema = new mongoose.Schema({
  quoteNumber: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true },
  customerAddress: { type: String, trim: true },
  items: [quoteItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  totalWeight: { type: Number, required: true, min: 0 },
  validityDays: { type: Number, default: 7 },
  notes: { type: String, trim: true },
  status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected'], default: 'Draft' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);
