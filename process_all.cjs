const fs = require('fs');
const readline = require('readline');
const path = require('path');

const files = [
  '/Users/foxtrot1/.gemini/antigravity/scratch/incline-dashboard/public/data.csv', // Aug 2025
  '/Users/foxtrot1/Desktop/Session Details 93025.csv',
  '/Users/foxtrot1/Desktop/Session Details 103125.csv',
  '/Users/foxtrot1/Desktop/Session Details 113025.csv',
  '/Users/foxtrot1/Desktop/Session Details 123125.csv',
  '/Users/foxtrot1/Desktop/Session Details 13126.csv',
  '/Users/foxtrot1/Desktop/Session Details 22826.csv',
];

const outputPath = '/Users/foxtrot1/.gemini/antigravity/scratch/incline-dashboard/public/master_data.csv';

async function processFile(filePath, outStream) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found, skipping: ${filePath}`);
    return;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let inTargetSection = false;

  for await (const line of rl) {
    if (line.startsWith('SessionName2')) {
      inTargetSection = true;
      continue; // Skip the raw header line itself
    }

    if (!inTargetSection) {
      continue; // Skip everything above the first SessionName2
    }

    if (!line.trim()) continue;

    // Use regex to properly split CSV respecting quotes
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());

    if (cols.length < 18) {
      if (!cols[7] || !cols[7].includes(':')) continue;
    }

    const sessionName = cols[0];
    const startDate = cols[3];
    const startTime = cols[7];
    const firstName = cols[9];
    const email = cols[10];
    const phone = cols[11];
    let address = cols[12];
    if (address && address.includes(',')) address = `"${address}"`; // re-quote if needed
    const totalQty = cols[15];
    const maxTemp = cols[17] || '';

    // Filter out rows that are just summaries
    if (!startTime || !startTime.includes(':')) continue;

    const outLine = `"${sessionName}","${startDate}","${startTime}","${firstName}","${email}","${phone}",${address ? `"${address.replace(/"/g, '')}"` : '""'},"${totalQty}","${maxTemp}"`;
    outStream.write(outLine + '\n');
  }
  
  console.log(`Processed: ${filePath}`);
}

async function main() {
  const outStream = fs.createWriteStream(outputPath);
  
  // Write Header
  const cleanHeader = 'SessionName,StartDate,StartTime,FirstName,PrimaryEmail,PrimaryPhone,Address,TotalQty,MaxTemp_F';
  outStream.write(cleanHeader + '\n');

  for (const file of files) {
    await processFile(file, outStream);
  }

  outStream.end();
  console.log(`\nAll files combined into ${outputPath}`);
}

main().catch(console.error);
