const fs = require('fs');
const readline = require('readline');
const path = require('path');

const masterCsvPath = path.join(__dirname, 'public', 'master_data.csv');
const minifiedCsvPath = path.join(__dirname, 'public', 'minified_data.csv');

async function main() {
  console.log('Compressing master_data.csv to strip PII and minimize payload...');
  const readStream = fs.createReadStream(masterCsvPath);
  const writeStream = fs.createWriteStream(minifiedCsvPath);
  const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (isHeader) {
      writeStream.write('StartDate,StartTime,ZipCode,TotalQty,MaxTemp_F\n');
      isHeader = false;
      continue;
    }
    
    // Parse the row respecting quotes
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());
    
    // master_data.csv structure:
    // SessionName (0), StartDate (1), StartTime (2), FirstName (3), PrimaryEmail (4), 
    // PrimaryPhone (5), Address (6), TotalQty (7), MaxTemp_F (8)
    
    if (cols.length < 8) continue;

    const startDate = cols[1];
    const startTime = cols[2];
    const address = cols[6];
    const totalQty = cols[7];
    const maxTemp = cols[8] || '';

    // Extract Zip Code from Address block if present
    let zipCode = '';
    if (address && address !== '-None Specified-') {
      const zipMatch = address.match(/(\d{5})(?:-\d{4})?\s*$/);
      if (zipMatch) zipCode = zipMatch[1];
    }

    // Skip empty lines or completely useless rows
    if (!startDate || !startTime) continue;

    const outLine = `"${startDate}","${startTime}","${zipCode}","${totalQty}","${maxTemp}"`;
    writeStream.write(outLine + '\n');
  }

  writeStream.end();
  
  writeStream.on('finish', () => {
    // Replace old master_data with minified subset, retaining old name for App.jsx compatibility 
    // Wait, let's keep it named minified_data.csv and update App.jsx so we know it's compressed
    console.log(`Successfully stripped out First Name, Email, Phone, and Raw Address! Saved to minified_data.csv`);
    
    // Quick size comparison
    const oldSize = fs.statSync(masterCsvPath).size / (1024 * 1024);
    const newSize = fs.statSync(minifiedCsvPath).size / (1024 * 1024);
    console.log(`Size reduced from ${oldSize.toFixed(2)} MB to ${newSize.toFixed(2)} MB`);
    
    // Overwrite master data entirely to save disk space and definitively destroy PII
    fs.renameSync(minifiedCsvPath, masterCsvPath);
    console.log(`Replaced public/master_data.csv with the minified, privacy-compliant version.`);
  });
}

main().catch(console.error);
