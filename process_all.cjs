const fs = require('fs');
const path = require('path');
const Papa = require('papaparse'); 

const files = [
  path.join(__dirname, 'public/data.csv'), // Aug 2025
  '/Users/foxtrot1/Desktop/Session Details 93025.csv',
  '/Users/foxtrot1/Desktop/Session Details 103125.csv',
  '/Users/foxtrot1/Desktop/Session Details 113025.csv',
  '/Users/foxtrot1/Desktop/Session Details 123125.csv',
  '/Users/foxtrot1/Desktop/Session Details 13126.csv',
  '/Users/foxtrot1/Desktop/Session Details 22826.csv',
  '/Users/foxtrot1/Downloads/Session Details March 2026.csv',
];

const outputPath = path.join(__dirname, 'public/master_data.csv');

async function processFile(filePath, outStream) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found, skipping: ${filePath}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(fileContent, { skipEmptyLines: true });

  let valid = 0;
  let inTargetSection = false;

  for (const row of parsed.data) {
    if (!row || row.length < 5) continue;
    
    // The first column sometimes has weird quotes or newlines, or a BOM
    let col0 = String(row[0]).trim().replace(/^\uFEFF/, '');
    
    // Toggle processing state based on headers
    if (col0 === 'SessionName2') {
      inTargetSection = true;
      continue;
    } else if (col0 === 'SessionName' || col0.startsWith('SessionName')) {
      inTargetSection = false;
      continue;
    }

    if (!inTargetSection) continue;
    if (!col0.includes('Manitou Incline')) continue;
    
    let startDate = String(row[3]).trim();
    let startTime = String(row[7] || '').trim();
    let address = String(row[12] || '').trim();
    let totalQty = String(row[15] || '').trim();
    let maxTemp = row.length > 16 ? String(row[17] || '').trim() : '';

    if (!startDate || !startTime || !startTime.includes(':')) continue;

    // Extract Zip
    let zipCode = '';
    if (address && address !== '-None Specified-') {
      const match = address.match(/(\d{5})(?:-\d{4})?\s*$/);
      if (match) zipCode = match[1];
    }

    // Default qtys
    if (!totalQty || isNaN(parseInt(totalQty, 10))) {
      totalQty = '1';
    }

    outStream.write(`"${startDate}","${startTime}","${zipCode}","${totalQty}","${maxTemp}"\n`);
    valid++;
  }
  console.log(`Processed: \x1b[36m${path.basename(filePath)}\x1b[0m -> extracted \x1b[32m${valid}\x1b[0m hikers`);
}

async function main() {
  const outStream = fs.createWriteStream(outputPath);
  
  // Header matching compressed schema
  outStream.write('StartDate,StartTime,ZipCode,TotalQty,MaxTemp_F\n');

  for (const file of files) {
    await processFile(file, outStream);
  }

  outStream.end();
  console.log(`\nAll files combined into ${outputPath}`);
}

main().catch(console.error);
