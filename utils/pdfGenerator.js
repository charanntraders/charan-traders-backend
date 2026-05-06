const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');

const IST = 'Asia/Kolkata';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Charan Traders';
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || 'Your Business Address';
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || '';
const BUSINESS_GST = process.env.BUSINESS_GST || '';

function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function formatDate(date) {
  return moment(date).tz(IST).format('DD/MM/YYYY');
}

function drawHeader(doc, title, subtitle = '') {
  // Business Header
  doc.fontSize(20).font('Helvetica-Bold').text(BUSINESS_NAME, { align: 'center' });
  if (BUSINESS_ADDRESS) doc.fontSize(10).font('Helvetica').text(BUSINESS_ADDRESS, { align: 'center' });
  if (BUSINESS_PHONE) doc.text(`Phone: ${BUSINESS_PHONE}`, { align: 'center' });
  if (BUSINESS_GST) doc.text(`GST: ${BUSINESS_GST}`, { align: 'center' });
  
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  if (subtitle) doc.fontSize(10).font('Helvetica').text(subtitle, { align: 'center' });
  
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawTableHeader(doc, columns, y) {
  doc.rect(50, y, 495, 20).fill('#2c3e50');
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  let x = 55;
  columns.forEach(col => {
    doc.text(col.header, x, y + 5, { width: col.width, align: col.align || 'left' });
    x += col.width;
  });
  doc.fillColor('black');
  return y + 20;
}

function drawTableRow(doc, columns, data, y, isEven) {
  if (isEven) doc.rect(50, y, 495, 18).fill('#f8f9fa');
  doc.fillColor('black').fontSize(8).font('Helvetica');
  let x = 55;
  columns.forEach(col => {
    const value = data[col.key] !== undefined ? String(data[col.key]) : '';
    doc.text(value, x, y + 4, { width: col.width, align: col.align || 'left' });
    x += col.width;
  });
  return y + 18;
}

async function generateCustomerLedgerPDF(ledgerData, dateRange) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const subtitle = dateRange ? `Period: ${dateRange.from} to ${dateRange.to}` : 'All Transactions';
    drawHeader(doc, 'Customer Ledger', subtitle);
    
    doc.fontSize(12).font('Helvetica-Bold').text(`Party: ${ledgerData.partyName}`);
    doc.moveDown(0.3);

    const columns = [
      { header: 'Date', key: 'formattedDate', width: 65, align: 'left' },
      { header: 'Type', key: 'entryTypeLabel', width: 65, align: 'left' },
      { header: 'Particulars', key: 'particulars', width: 160, align: 'left' },
      { header: 'Debit (₹)', key: 'debitStr', width: 80, align: 'right' },
      { header: 'Credit (₹)', key: 'creditStr', width: 80, align: 'right' },
      { header: 'Balance (₹)', key: 'balanceStr', width: 85, align: 'right' }
    ];

    let y = drawTableHeader(doc, columns, doc.y);

    ledgerData.ledgerEntries.forEach((entry, i) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
        y = drawTableHeader(doc, columns, y);
      }
      const row = {
        formattedDate: entry.formattedDate,
        entryTypeLabel: entry.entryType === 'sale' ? 'Sale' : entry.entryType === 'payment' ? 'Payment' : 'Adjustment',
        particulars: entry.entryType === 'sale' ? `${entry.materialName} ${entry.quantity}${entry.unit || 'kg'} @${entry.rate}` : entry.entryType === 'adjustment' ? entry.reason : (entry.reference || 'Payment received'),
        debitStr: entry.debit > 0 ? formatCurrency(entry.debit) : '',
        creditStr: entry.credit > 0 ? formatCurrency(entry.credit) : '',
        balanceStr: formatCurrency(entry.runningBalance)
      };
      y = drawTableRow(doc, columns, row, y, i % 2 === 0);
    });

    // Summary
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total Sales: ${formatCurrency(ledgerData.totalSales)}`, 50);
    doc.text(`Total Received: ${formatCurrency(ledgerData.totalReceived)}`, 50);
    doc.text(`Outstanding Balance: ${formatCurrency(ledgerData.totalDue)}`, 50);
    
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor('#888').text(`Generated on: ${moment().tz(IST).format('DD/MM/YYYY HH:mm')} IST`, { align: 'right' });
    
    doc.end();
  });
}

async function generateQuotePDF(quoteData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawHeader(doc, 'QUOTATION');

    // Quote details
    doc.fontSize(10).font('Helvetica');
    doc.text(`Quote No: ${quoteData.quoteNumber}`, 50);
    doc.text(`Date: ${formatDate(quoteData.date)}`, 50);
    doc.text(`Valid Until: ${formatDate(new Date(new Date(quoteData.date).getTime() + (quoteData.validityDays || 7) * 86400000))}`, 50);
    doc.moveDown(0.5);
    
    doc.font('Helvetica-Bold').text('To:', 50);
    doc.font('Helvetica').text(quoteData.customerName, 50);
    if (quoteData.customerPhone) doc.text(`Phone: ${quoteData.customerPhone}`, 50);
    if (quoteData.customerAddress) doc.text(quoteData.customerAddress, 50);

    doc.moveDown(0.5);

    const columns = [
      { header: 'Brand', key: 'brand', width: 80, align: 'left' },
      { header: 'Size', key: 'size', width: 50, align: 'center' },
      { header: 'No. of Rods', key: 'numberOfRods', width: 70, align: 'right' },
      { header: 'Wt/Rod (kg)', key: 'weightPerRod', width: 75, align: 'right' },
      { header: 'Total Wt (kg)', key: 'totalWeight', width: 75, align: 'right' },
      { header: 'Rate/kg (₹)', key: 'ratePerKg', width: 75, align: 'right' },
      { header: 'Amount (₹)', key: 'amountStr', width: 70, align: 'right' }
    ];

    let y = drawTableHeader(doc, columns, doc.y);

    quoteData.items.forEach((item, i) => {
      const row = {
        ...item,
        amountStr: formatCurrency(item.amount)
      };
      y = drawTableRow(doc, columns, row, y, i % 2 === 0);
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Total Weight: ${quoteData.totalWeight.toFixed(2)} kg`, { align: 'right' });
    doc.text(`Total Amount: ${formatCurrency(quoteData.totalAmount)}`, { align: 'right' });
    
    if (quoteData.notes) {
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:');
      doc.font('Helvetica').text(quoteData.notes);
    }

    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica').fillColor('#888').text(`This quotation is valid for ${quoteData.validityDays || 7} days from the date of issue.`);
    doc.text(`Generated on: ${moment().tz(IST).format('DD/MM/YYYY HH:mm')} IST`, { align: 'right' });

    doc.end();
  });
}

async function generateSalesReportPDF(salesData, dateRange, reportType) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const subtitle = dateRange ? `Period: ${dateRange.from} to ${dateRange.to}` : 'All Time';
    drawHeader(doc, reportType === 'cash' ? 'Cash Sales Report' : 'Sales Report', subtitle);

    const columns = reportType === 'cash' ? [
      { header: 'Date', key: 'formattedDate', width: 65 },
      { header: 'Customer', key: 'customerName', width: 110 },
      { header: 'Material', key: 'materialName', width: 100 },
      { header: 'Qty', key: 'quantityStr', width: 50, align: 'right' },
      { header: 'Rate', key: 'rateStr', width: 60, align: 'right' },
      { header: 'Amount', key: 'amountStr', width: 60, align: 'right' },
      { header: 'Mode', key: 'paymentMode', width: 50 }
    ] : [
      { header: 'Date', key: 'formattedDate', width: 65 },
      { header: 'Party', key: 'partyName', width: 120 },
      { header: 'Material', key: 'materialName', width: 110 },
      { header: 'Qty', key: 'quantityStr', width: 50, align: 'right' },
      { header: 'Rate', key: 'rateStr', width: 60, align: 'right' },
      { header: 'Amount', key: 'amountStr', width: 90, align: 'right' }
    ];

    let y = drawTableHeader(doc, columns, doc.y);

    salesData.entries.forEach((entry, i) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
        y = drawTableHeader(doc, columns, y);
      }
      const row = {
        ...entry,
        formattedDate: formatDate(entry.date),
        quantityStr: `${entry.quantity} ${entry.unit || 'kg'}`,
        rateStr: formatCurrency(entry.rate),
        amountStr: formatCurrency(entry.amount)
      };
      y = drawTableRow(doc, columns, row, y, i % 2 === 0);
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text(`Total: ${formatCurrency(salesData.total)}`, { align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('#888').text(`Generated on: ${moment().tz(IST).format('DD/MM/YYYY HH:mm')} IST`, { align: 'right' });

    doc.end();
  });
}

module.exports = { generateCustomerLedgerPDF, generateQuotePDF, generateSalesReportPDF };
