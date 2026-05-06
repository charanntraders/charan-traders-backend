const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  type: { type: String, enum: ['customer', 'vendor', 'both'], default: 'customer' },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

partySchema.index({ name: 'text' });

module.exports = mongoose.model('Party', partySchema);
