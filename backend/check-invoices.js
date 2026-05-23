const mongoose = require('mongoose');
require('dotenv').config();

async function checkInvoices() {
  try {
    // Connect to MongoDB directly
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/emr_healthcare_db';
    await mongoose.connect(mongoURI);

    console.log('✅ Successfully connected to database');

    // Get invoices collection directly
    const db = mongoose.connection.db;
    const invoicesCollection = db.collection('invoices');

    // Get total count
    const invoiceCount = await invoicesCollection.countDocuments();
    console.log(`🔢 Total invoices in database: ${invoiceCount}`);

    if (invoiceCount > 0) {
      console.log('\n📋 All Invoices in Database:');
      console.log('='.repeat(80));

      const invoices = await invoicesCollection.find({})
        .sort({ createdAt: -1 })
        .toArray();

      invoices.forEach((invoice, index) => {
        console.log(`${index + 1}. ${invoice.invoiceNumber} - ${invoice.patientName}`);
        console.log(`   Amount: $${invoice.totalAmount}`);
        console.log(`   Status: ${invoice.status}`);
        console.log(`   Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`);
        console.log(`   Items: ${invoice.items?.length || 0} items`);
        if (invoice.paymentDate) {
          console.log(`   Paid Date: ${new Date(invoice.paymentDate).toLocaleDateString()}`);
        }
        console.log('');
      });

      // Show statistics
      console.log('📊 Invoice Statistics:');
      console.log('-'.repeat(40));

      const statusStats = await invoicesCollection.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();

      statusStats.forEach(stat => {
        console.log(`   ${stat._id}: ${stat.count}`);
      });

      const totalAmount = await invoicesCollection.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).toArray();

      console.log(`\n   Total Amount: $${totalAmount[0]?.total?.toFixed(2) || '0.00'}`);

    } else {
      console.log('📭 No invoices found in database');
      console.log('\n💡 To add sample invoices, run: node scripts/add-sample-invoices.js');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error checking invoices:', error.message);
  }
}

checkInvoices();
