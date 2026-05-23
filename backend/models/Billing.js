const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  billId: {
    type: String,
    unique: true,
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  items: [{
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'insurance', 'online']
  },
  dueDate: {
    type: Date,
    required: true
  },
  notes: String
}, {
  timestamps: true
});

billingSchema.pre('save', async function(next) {
  if (!this.billId) {
    const count = await mongoose.models.Billing.countDocuments();
    this.billId = `BILL${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Billing', billingSchema);