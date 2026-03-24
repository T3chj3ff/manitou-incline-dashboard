const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function cleanCSV(inputPath, outputPath) {
  const fileStream = fs.createReadStream(inputPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const outStream = fs.createWriteStream(outputPath);

  let inTargetSection = false;
  let isFirstHeader = true;

  for await (const line of rl) {
    if (line.startsWith('SessionName2')) {
      inTargetSection = true;
      if (isFirstHeader) {
        // We hit the first SessionName2 header.
        // Let's write our clean header.
        const cleanHeader = 'SessionName,StartDate,StartTime,FirstName,PrimaryEmail,PrimaryPhone,Address,TotalQty,MaxTemp_F';
        outStream.write(cleanHeader + '\n');
        isFirstHeader = false;
      }
      continue; // Skip the raw header line itself
    }

    if (!inTargetSection) {
      continue; // Skip everything above the first SessionName2
    }

    // Process the data line
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

  outStream.end();
  console.log(`Finished processing. Cleaned data written to ${outputPath}`);
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('Usage: node clean_data.cjs <input.csv> <output.csv>');
  process.exit(1);
}

cleanCSV(input, output).catch(console.error);
