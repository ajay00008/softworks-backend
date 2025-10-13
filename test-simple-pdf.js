const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function createSimplePDF() {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `test-simple-${Date.now()}.pdf`;
      const filePath = path.join(__dirname, 'public', 'question-papers', fileName);
      
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        autoFirstPage: true
      });

      // Create write stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Handle stream events
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        reject(error);
      });

      stream.on('finish', () => {
        console.log('PDF generation completed successfully');
        console.log('File created at:', filePath);
        resolve({ fileName, filePath });
      });

      // Add simple content
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('Test Question Paper', { align: 'center' });
      
      doc.moveDown(1);
      
      doc.fontSize(12)
         .font('Helvetica')
         .text('This is a test PDF to verify compatibility.');
      
      doc.moveDown(1);
      
      doc.fontSize(11)
         .text('Q1. What is 2 + 2?')
         .text('A) 3')
         .text('B) 4')
         .text('C) 5')
         .text('D) 6');

      // Finalize PDF
      doc.end();
      
    } catch (error) {
      console.error('Error creating PDF:', error);
      reject(error);
    }
  });
}

// Run the test
createSimplePDF()
  .then(result => {
    console.log('Success:', result);
  })
  .catch(error => {
    console.error('Failed:', error);
  });
