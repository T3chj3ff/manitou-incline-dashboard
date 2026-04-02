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

async function processFile(filePath, outStream, weatherMap) {
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
    
    if (!startDate || !startTime || !startTime.includes(':')) continue;
    
    let maxTemp = '';
    let precip = '';
    let aqi = '';
    // Apply dynamic weather fetching based on the date
    const parts = startDate.split('/');
    if (parts.length === 3) {
      let m = parts[0].padStart(2, '0');
      let d = parts[1].padStart(2, '0');
      let y = parts[2];
      const formattedDate = `${y}-${m}-${d}`;
      if (weatherMap[formattedDate]) {
        maxTemp = weatherMap[formattedDate].maxTemp;
        precip = weatherMap[formattedDate].precip;
        aqi = weatherMap[formattedDate].aqi;
      }
    }

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

    outStream.write(`"${startDate}","${startTime}","${zipCode}","${totalQty}","${maxTemp}","${precip}","${aqi}"\n`);
    valid++;
  }
  console.log(`Processed: \x1b[36m${path.basename(filePath)}\x1b[0m -> extracted \x1b[32m${valid}\x1b[0m hikers`);
}

async function main() {
  console.log('Fetching historical weather and air quality data from Open-Meteo...');
  const weatherMap = {};
  try {
    // Dynamic end_date up to today
    const today = new Date();
    const endDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Fetch Main Weather (Temp + Rain)
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=38.8576&longitude=-104.9304&start_date=2025-08-01&end_date=${endDateStr}&daily=temperature_2m_max,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FDenver`);
    const data = await res.json();
    
    // Fetch Air Quality (AQI) - Note: Air Quality API uses a different domain
    const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=38.8576&longitude=-104.9304&start_date=2025-08-01&end_date=${endDateStr}&hourly=us_aqi&timezone=America%2FDenver`);
    const aqiData = await aqiRes.json();

    if (data && data.daily && data.daily.time) {
      for (let i = 0; i < data.daily.time.length; i++) {
        const dateStr = data.daily.time[i];
        weatherMap[dateStr] = {
          maxTemp: data.daily.temperature_2m_max[i],
          precip: data.daily.precipitation_sum[i] || 0,
          aqi: 0
        };
      }
    }
    
    if (aqiData && aqiData.hourly && aqiData.hourly.time) {
      // Calculate daily max AQI from hourly array
      let currentDay = '';
      let maxAqiForDay = 0;
      for (let i = 0; i < aqiData.hourly.time.length; i++) {
        const timeStr = aqiData.hourly.time[i]; // e.g. "2025-08-01T00:00"
        if (!timeStr) continue;
        const day = timeStr.split('T')[0];
        const aqi = aqiData.hourly.us_aqi[i];
        
        if (day !== currentDay) {
          if (currentDay && weatherMap[currentDay]) { 
            weatherMap[currentDay].aqi = maxAqiForDay; 
          }
          currentDay = day;
          maxAqiForDay = aqi || 0;
        } else {
          if (aqi > maxAqiForDay) maxAqiForDay = aqi;
        }
      }
      if (currentDay && weatherMap[currentDay]) { 
        weatherMap[currentDay].aqi = maxAqiForDay; 
      }
      console.log(`Fetched historical weather mapping for ${Object.keys(weatherMap).length} days.`);
    }
  } catch (err) {
    console.error("Warning: Failed to fetch weather map", err.message);
  }

  const outStream = fs.createWriteStream(outputPath);
  
  // Header matching new expanded schema
  outStream.write('StartDate,StartTime,ZipCode,TotalQty,MaxTemp_F,Precipitation,AQI\n');

  for (const file of files) {
    await processFile(file, outStream, weatherMap);
  }

  outStream.end();
  console.log(`\nAll files combined into ${outputPath}`);
}

main().catch(console.error);
