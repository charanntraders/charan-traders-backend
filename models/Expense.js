const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  category: { 
    type: String, 
    required: true, 
    trim: true,
    enum: ['Transport', 'Labour', 'Office', 'Rent', 'Utilities', 'Salary', 'Maintenance', 'Miscellaneous', 'Other']
  },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, enum: ['Cash', 'UPI', 'Bank'], default: 'Cash' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed }
  }]
}, { timestamps: true });

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
