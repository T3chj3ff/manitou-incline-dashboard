const fs = require('fs');
const readline = require('readline');

const masterCsvPath = '/Users/foxtrot1/.gemini/antigravity/scratch/incline-dashboard/public/master_data.csv';
const tempCsvPath = '/Users/foxtrot1/.gemini/antigravity/scratch/incline-dashboard/public/master_data_temp.csv';

// Manitou Springs Lat/Lon
const lat = 38.8576;
const lon = -104.9304;
const startDate = '2025-08-01';
const endDate = '2026-02-28';

const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max&temperature_unit=fahrenheit&timezone=America%2FDenver`;

async function main() {
  console.log('Fetching historical weather data from Open-Meteo...');
  const res = await fetch(url);
  const data = await res.json();
  
  const weatherMap = {};
  if (data && data.daily && data.daily.time) {
    for (let i = 0; i < data.daily.time.length; i++) {
      const dateStr = data.daily.time[i]; // YYYY-MM-DD
      const maxTemp = data.daily.temperature_2m_max[i];
      weatherMap[dateStr] = maxTemp;
    }
    console.log(`Fetched weather for ${Object.keys(weatherMap).length} days.`);
  } else {
    console.error("Failed to fetch weather data", data);
    return;
  }

  console.log('Patching master_data.csv...');
  const readStream = fs.createReadStream(masterCsvPath);
  const writeStream = fs.createWriteStream(tempCsvPath);
  const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      writeStream.write(line + '\n');
      isHeader = false;
      continue;
    }
    
    // Parse the row
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());
    
    if (cols.length < 8) continue;

    const startDateRaw = cols[1]; // e.g. "9/30/2025" or "09/30/2025"
    let maxTemp = cols[8] || ''; // Exists in August, empty in others

    if (startDateRaw) {
      const parts = startDateRaw.split('/');
      if (parts.length === 3) {
        let m = parts[0].padStart(2, '0');
        let d = parts[1].padStart(2, '0');
        let y = parts[2];
        const formattedDate = `${y}-${m}-${d}`;
        
        if (weatherMap[formattedDate] !== undefined) {
          maxTemp = weatherMap[formattedDate];
        }
      }
    }

    // Rewrite row
    const sessionName = cols[0];
    const startDate = cols[1];
    const startTime = cols[2];
    const firstName = cols[3];
    const email = cols[4];
    const phone = cols[5];
    let address = cols[6];
    const totalQty = cols[7];

    const outLine = `"${sessionName}","${startDate}","${startTime}","${firstName}","${email}","${phone}",${address ? `"${address.replace(/"/g, '')}"` : '""'},"${totalQty}","${maxTemp}"`;
    writeStream.write(outLine + '\n');
  }

  writeStream.end();
  
  writeStream.on('finish', () => {
    fs.renameSync(tempCsvPath, masterCsvPath);
    console.log('Successfully backfilled weather data!');
  });
}

main().catch(console.error);
