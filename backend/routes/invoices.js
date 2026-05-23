const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
// const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// @route   GET /api/invoices
// @desc    Get all invoices
// @access  Public (for testing)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, startDate, endDate } = req.query;
    
    let query = {};
    
    // Add filters
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate && endDate) {
      query.invoiceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const invoices = await Invoice.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ invoiceDate: -1 });

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching invoices',
      error: error.message
    });
  }
});

// @route   GET /api/invoices/patient/:patientId
// @desc    Get invoices by patient ID
// @access  Private
router.get('/patient/:patientId', async (req, res) => {
  try {
    const invoices = await Invoice.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching patient invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient invoices',
      error: error.message
    });
  }
});

// @route   GET /api/invoices/:id
// @desc    Get invoice by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching invoice',
      error: error.message
    });
  }
});

// @route   POST /api/invoices
// @desc    Create new invoice
// @access  Private
router.post('/', [
  // auth, // Temporarily disabled for testing
  body('patientId').isMongoId().withMessage('Valid patient ID is required'),
  body('patientName').notEmpty().withMessage('Patient name is required'),
  body('invoiceNumber').notEmpty().withMessage('Invoice number is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').notEmpty().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Valid quantity is required'),
  body('items.*.rate').isFloat({ min: 0 }).withMessage('Valid rate is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      patientId,
      patientName,
      invoiceNumber,
      dueDate,
      terms,
      items,
      taxRate,
      discountRate,
      paymentMethod,
      insurance,
      notes,
      internalNotes
    } = req.body;

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if invoice number already exists
    const existingInvoice = await Invoice.findOne({ invoiceNumber });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists'
      });
    }

    const invoice = new Invoice({
      patientId,
      patientName,
      invoiceNumber,
      dueDate,
      terms: terms || 'Net 30',
      items,
      taxRate: taxRate || 0,
      discountRate: discountRate || 0,
      paymentMethod,
      insurance,
      notes,
      internalNotes
    });

    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating invoice',
      error: error.message
    });
  }
});

// @route   PUT /api/invoices/:id
// @desc    Update invoice
// @access  Private
router.put('/:id', /* auth, */ async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Don't allow updates to paid invoices
    if (invoice.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid invoice'
      });
    }

    const allowedUpdates = [
      'dueDate', 'terms', 'items', 'taxRate', 'discountRate',
      'paymentMethod', 'insurance', 'notes', 'internalNotes'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    invoice.updatedAt = new Date();
    await invoice.save();

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating invoice',
      error: error.message
    });
  }
});

// @route   PUT /api/invoices/:id/status
// @desc    Update invoice status
// @access  Private
router.put('/:id/status', [
  // auth, // Temporarily disabled for testing
  body('status').isIn(['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const { status, paymentMethod, paymentReference } = req.body;

    if (status === 'Sent') {
      await invoice.markAsSent();
    } else if (status === 'Paid') {
      await invoice.markAsPaid(paymentMethod, paymentReference);
    } else if (status === 'Cancelled') {
      await invoice.cancel();
    } else {
      invoice.status = status;
      await invoice.save();
    }

    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating invoice status',
      error: error.message
    });
  }
});

// @route   POST /api/invoices/:id/payments
// @desc    Add partial payment to invoice
// @access  Private
router.post('/:id/payments', [
  // auth, // Temporarily disabled for testing
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid payment amount is required'),
  body('method').notEmpty().withMessage('Payment method is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const { amount, method, reference } = req.body;

    // Check if payment amount exceeds remaining balance
    if (amount > invoice.remainingBalance) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds remaining balance'
      });
    }

    await invoice.addPartialPayment({
      amount,
      method,
      reference
    });

    res.json({
      success: true,
      message: 'Payment added successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding payment',
      error: error.message
    });
  }
});

// @route   GET /api/invoices/overdue
// @desc    Get overdue invoices
// @access  Private
router.get('/overdue', /* auth, */ async (req, res) => {
  try {
    const overdueInvoices = await Invoice.findOverdue();

    res.json({
      success: true,
      data: overdueInvoices
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching overdue invoices',
      error: error.message
    });
  }
});

// @route   GET /api/invoices/stats/overview
// @desc    Get invoice statistics
// @access  Private
router.get('/stats/overview', /* auth, */ async (req, res) => {
  try {
    const totalInvoices = await Invoice.countDocuments();
    const paidInvoices = await Invoice.countDocuments({ status: 'Paid' });
    const pendingInvoices = await Invoice.countDocuments({ status: { $in: ['Draft', 'Sent'] } });
    const overdueInvoices = await Invoice.countDocuments({ status: 'Overdue' });
    
    // Calculate total revenue
    const revenueStats = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;
    
    // Calculate outstanding amount
    const outstandingStats = await Invoice.aggregate([
      { $match: { status: { $nin: ['Paid', 'Cancelled'] } } },
      { $group: { _id: null, totalOutstanding: { $sum: '$total' } } }
    ]);
    
    const totalOutstanding = outstandingStats.length > 0 ? outstandingStats[0].totalOutstanding : 0;

    // Monthly revenue trend
    const monthlyRevenue = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          revenue: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        overdueInvoices,
        totalRevenue,
        totalOutstanding,
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching invoice statistics',
      error: error.message
    });
  }
})

module.exports = router;
