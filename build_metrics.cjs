const fs = require('fs');
const readline = require('readline');
const path = require('path');

const csvPath = path.join(__dirname, 'public', 'master_data.csv');
const jsonPath = path.join(__dirname, 'public', 'metrics.json');

async function main() {
  console.log('Pre-compiling 110k CSV rows into a static JSON metrics file...');
  
  const readStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

  let totalHikers = 0;
  const dateDataMap = {};
  const zipCountsCo = {};
  const zipCountsOut = {};
  const monthDataMap = {};
  const peakHourMap = {};
  const DOWDataMap = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };

  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    if (!line.trim()) continue;

    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());
    
    // StartDate,StartTime,ZipCode,TotalQty,MaxTemp_F
    if (cols.length < 4) continue;

    const startDate = cols[0];
    const startTime = cols[1];
    const zipCode = cols[2];
    const totalQty = cols[3];
    const maxTemp = cols[4] || '';

    const qty = parseInt(totalQty, 10) || 1;
    totalHikers += qty;

    if (startTime) {
       const [hourStr] = startTime.split(':');
       let hourNum = parseInt(hourStr, 10);
       if (!isNaN(hourNum)) {
           const ampm = hourNum >= 12 ? 'PM' : 'AM';
           const h = hourNum % 12 || 12;
           const label = `${h} ${ampm}`;
           if (!peakHourMap[hourNum]) {
              peakHourMap[hourNum] = { label, hikers: 0, sortHour: hourNum };
           }
           peakHourMap[hourNum].hikers += qty;
       }
    }

    if (startDate) {
      if (!dateDataMap[startDate]) {
        dateDataMap[startDate] = { date: startDate, hikers: 0, temp: null };
      }
      dateDataMap[startDate].hikers += qty;
      
      if (maxTemp) {
        dateDataMap[startDate].temp = parseFloat(maxTemp);
      }

      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        const monthKeyStr = d.toISOString().substring(0, 7);
        const monthLabel = `${d.toLocaleString('default', { month: 'short' })} '${d.getFullYear().toString().slice(-2)}`;
        if (!monthDataMap[monthKeyStr]) {
           monthDataMap[monthKeyStr] = { label: monthLabel, sortKey: monthKeyStr, hikers: 0 };
        }
        monthDataMap[monthKeyStr].hikers += qty;

        const dow = d.toLocaleString('default', { weekday: 'short' });
        if (DOWDataMap[dow] !== undefined) {
          DOWDataMap[dow] += qty;
        }
      }
    }

    if (zipCode) {
      if (zipCode.startsWith('80') || zipCode.startsWith('81')) {
        zipCountsCo[zipCode] = (zipCountsCo[zipCode] || 0) + qty;
      } else {
        zipCountsOut[zipCode] = (zipCountsOut[zipCode] || 0) + qty;
      }
    }
  }

  // Formatting arrays
  const datesArray = Object.values(dateDataMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  const monthlyArray = Object.values(monthDataMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const peakHourArray = Object.values(peakHourMap).sort((a, b) => a.sortHour - b.sortHour);
  
  const dowOrder = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const dowArray = Object.entries(DOWDataMap)
    .sort((a, b) => dowOrder[a[0]] - dowOrder[b[0]])
    .map(([label, hikers]) => ({ label, hikers }));
  
  let avgTemp = 0;
  let daysWithTemp = 0;
  datesArray.forEach(d => {
    if (d.temp !== null && !isNaN(d.temp)) {
      avgTemp += d.temp;
      daysWithTemp++;
    }
  });
  avgTemp = daysWithTemp ? (avgTemp / daysWithTemp).toFixed(1) : 'N/A';

  const allZips = { ...zipCountsCo, ...zipCountsOut };
  const topZip = Object.keys(allZips).length
    ? Object.entries(allZips).sort((a,b) => b[1] - a[1])[0][0]
    : 'N/A';

  const peakHourMetric = peakHourArray.length 
    ? [...peakHourArray].sort((a,b) => b.hikers - a.hikers)[0].label 
    : 'N/A';

  const topZipCoData = Object.entries(zipCountsCo)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .map(([zip, count]) => ({ zip, hikers: count }));

  const topZipOutData = Object.entries(zipCountsOut)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .map(([zip, count]) => ({ zip, hikers: count }));

  const totalOutQty = Object.values(zipCountsOut).reduce((sum, count) => sum + count, 0);
  const tourismPercent = totalHikers > 0 ? Math.round((totalOutQty / totalHikers) * 100) : 0;

  let momGrowth = 'N/A';
  if (monthlyArray.length >= 2) {
    const lastMonth = monthlyArray[monthlyArray.length - 1].hikers;
    const prevMonth = monthlyArray[monthlyArray.length - 2].hikers;
    if (prevMonth > 0) {
      const growth = ((lastMonth - prevMonth) / prevMonth) * 100;
      momGrowth = `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
    }
  }

  const payload = {
    totalHikers,
    uniqueDays: Object.keys(dateDataMap).length,
    peakHourMetric,
    topZip,
    avgTemp,
    tourismPercent,
    momGrowth,
    dateData: datesArray,
    monthlyArray,
    dowArray,
    peakHourArray,
    topZipCoData,
    topZipOutData
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload));
  console.log(`Successfully generated dynamic metrics payload at ${jsonPath}`);
  console.log(`Payload size: ${(fs.statSync(jsonPath).size / 1024).toFixed(2)} KB // 0 MS load times on frontend!`);
}

main().catch(console.error);
