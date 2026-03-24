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

    const parts = line.split(',');
    
    // Sometimes there are nested quotes. For this simple data, the split by comma might be enough,
    // but we can be careful. Let's just use simple split as the data looks well-formed enough.
    // The columns based on our analysis:
    // 0: SessionName2
    // 3: StartDate2
    // 7: StartTime2
    // 9: FirstName2
    // 10: PrimaryEmail2
    // 11: PrimaryPhone2
    // 12: Address2
    // 15: TotalQty2
    // 17: MaxTemp_F (appended without header)

    // Wait, Address might contain commas. We should handle csv properly if so.
    // A simple regex to split by commas outside quotes:
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());

    if (cols.length < 18) {
      // We might have lines that are summary rows or empty.
      // e.g. "Manitou Incline,Session Count : 18249,$0.00,8/29/2025,Day Count : 442,Manitou Incline,442,,,,,,,,,,,69.8"
      // Wait, 442,,,,,,,,,,,69.8 has enough commas.
      // If there's no start time, we should probably skip it.
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

    const outLine = `${sessionName},${startDate},${startTime},${firstName},${email},${phone},${address},${totalQty},${maxTemp}`;
    outStream.write(outLine + '\n');
  }

  outStream.end();
  console.log(`Finished processing. Cleaned data written to ${outputPath}`);
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('Usage: node clean_data.js <input.csv> <output.csv>');
  process.exit(1);
}

cleanCSV(input, output).catch(console.error);
