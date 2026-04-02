import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Line, Legend
} from 'recharts';
import { Users, Activity, Thermometer, Clock, TrendingUp, Globe, Wind, Droplets } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Tooltip as MapTooltip } from "react-simple-maps";
import { scaleQuantile } from "d3-scale";
import './App.css';

const geoUrl = "/usa-states.json";

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }) => (
  <div className="stat-card" tabIndex="0" role="article" aria-label={`${title}: ${value}`}>
    <div className={`stat-icon ${colorClass}`}>
      <Icon size={28} aria-hidden="true" />
    </div>
    <div className="stat-content">
      <h3>{title}</h3>
      <p>{value}</p>
      {subtext && <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>{subtext}</span>}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '12px',
        borderRadius: '8px',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <p style={{ margin: 0, fontWeight: 600, color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: 0, fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: p.fill || p.stroke }}></span>
            {p.value} {p.name || p.dataKey}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function App() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [tooltipContent, setTooltipContent] = useState("");

  const colorScale = metrics?.stateMapData ? scaleQuantile()
    .domain(metrics.stateMapData.map(d => d.value))
    .range([
      "#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", 
      "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"
    ]) : null;

  useEffect(() => {
    // Fetch live weather from Manitou Springs via Open-Meteo
    fetch('https://api.open-meteo.com/v1/forecast?latitude=38.8576&longitude=-104.9304&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FDenver')
      .then(res => res.json())
      .then(resData => {
        if (resData && resData.current) {
          setCurrentWeather(resData.current);
        }
      }).catch(err => console.error("Weather fetch error:", err));
    fetch('/metrics.json')
      .then(res => res.json())
      .then(jsonMetrics => {
        setMetrics(jsonMetrics);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading metrics.json:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <h2 style={{ color: '#94a3b8', fontWeight: 500 }}>Loading Historical Master Dataset...</h2>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="loader-container">
        <h2 style={{ color: '#ef4444' }}>No valid data found in master_data.csv</h2>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="header">
        <div className="header-title">
          <div className="icon-wrapper" style={{ background: 'var(--accent-glow)'}}>
            <Activity size={24} color="#3b82f6" />
          </div>
          <div className="title-text">
            <h1>Incline Intelligence Hub</h1>
            <p>Historical Session Metrics (YTD) & Trailhead Conditions</p>
          </div>
        </div>
      </header>

      <section className="stats-grid" role="region" aria-label="Key Performance Indicators">
        <StatCard 
          title="Total Reservations" 
          value={metrics.totalHikers.toLocaleString()} 
          icon={Users} 
          colorClass="blue" 
        />
        <StatCard 
          title="MoM Growth" 
          value={metrics.momGrowth} 
          subtext="Vs. Previous Month"
          icon={TrendingUp} 
          colorClass="green" 
        />
        <StatCard 
          title="Tourism Draw" 
          value={`${metrics.tourismPercent}%`} 
          subtext="Out-of-State Hikers"
          icon={Globe} 
          colorClass="purple" 
        />
        <StatCard 
          title="Peak Session Hour" 
          value={metrics.peakHourMetric} 
          icon={Clock} 
          colorClass="orange" 
        />
      </section>

      <section className="charts-grid">
        <div className="chart-card" role="region" aria-label="Monthly Trend Chart">
          <div className="chart-header">
            <h3>Monthly Trend</h3>
            <p>Hiker volume grouped by month Year-to-Date</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.monthlyArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="hikers" name="Total Hikers" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Peak Times Distribution</h3>
            <p>Hiker volume by hour of the day</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.peakHourArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="hikers" name="Hikers" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPeak)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card full-width">
          <div className="chart-header">
            <h3>Hiker Traffic vs High Temperature (Daily Timeline)</h3>
            <p>Mapping daily attendance alongside local maximum temperatures</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={metrics.dateData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHikers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" stroke="#3b82f6" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" axisLine={false} tickLine={false} />
                <YAxis yAxisId="aqi" orientation="right" stroke="#ef4444" axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36}/>
                <Bar yAxisId="left" dataKey="precip" name="Rain/Snow (in)" fill="#60a5fa" opacity={0.5} barSize={20} />
                <Area yAxisId="left" type="monotone" dataKey="hikers" name="Daily Hikers" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorHikers)" />
                <Line yAxisId="right" type="monotone" dataKey="temp" name="Max Temp (°F)" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="aqi" type="monotone" dataKey="aqi" name="AQI (Smoke)" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Popular Days of the Week</h3>
            <p>Summary of reservations based on day of week</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.dowArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="hikers" name="Total Hikers" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Top 10 Colorado Zip Codes</h3>
            <p>Highest volume of in-state hikers</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topZipCoData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="zip" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="hikers" name="Hikers" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Top 10 Out-of-State Zip Codes</h3>
            <p>Highest volume of non-Colorado residents</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topZipOutData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="zip" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="hikers" name="Hikers" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card" role="region" aria-label="Current Weather Conditions">
          <div className="chart-header">
            <h3>Current Weather at Trailhead</h3>
            <p>Live conditions from Manitou Springs, CO</p>
          </div>
          <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', height: '100%', paddingBottom: '2rem' }}>
            {currentWeather ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', marginTop: '1rem' }}>
                  <Thermometer size={48} color="#f59e0b" />
                  <div>
                    <h2 style={{ fontSize: '3.5rem', margin: 0, lineHeight: 1, color: '#f8fafc' }}>{Math.round(currentWeather.temperature_2m)}°F</h2>
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.1rem', marginTop: '0.25rem' }}>Feels like {Math.round(currentWeather.apparent_temperature)}°F</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Wind size={24} color="#3b82f6" />
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wind Speed</p>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: '#f8fafc' }}>{currentWeather.wind_speed_10m} mph</p>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Droplets size={24} color="#10b981" />
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Humidity</p>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: '#f8fafc' }}>{currentWeather.relative_humidity_2m}%</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                <p>Loading live weather data...</p>
              </div>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}

export default App;
