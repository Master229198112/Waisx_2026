import React, { useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ZAxis,
  BarChart, Bar, Legend, LineChart, Line, ReferenceArea, ReferenceLine, Label, AreaChart, Area,
  PieChart, Pie, LabelList
} from 'recharts';
import { Filter, Download, Activity, TrendingUp, AlertTriangle, Info, ShieldCheck, Lightbulb, ArrowRight, Database, SlidersHorizontal, CheckCircle2, Upload, Lock, X, FileText, LogOut } from 'lucide-react';
import { syntheticData as initialData, SkillData, Industry, SkillCategory, ExperienceLevel, TimePeriod, QuadrantLabel } from './data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';

const COLORS = {
  'AI & Technical': '#3b82f6',
  'Cognitive & Behavioral': '#10b981',
  'Governance & Ethics': '#f59e0b',
};

export default function App() {
  const [data, setData] = useState<SkillData[]>(initialData);
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | 'All'>('All');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'All'>('All');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Q1 2026');
  
  const [simulateSupply, setSimulateSupply] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<any | null>(null);

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Filter data based on period and other filters
  const currentData = useMemo(() => {
    if (selectedPeriod === 'All Time') return data;
    if (selectedPeriod === 'FY 2025') return data.filter(d => d.timePeriod.includes('2025'));
    return data.filter(d => d.timePeriod === selectedPeriod);
  }, [data, selectedPeriod]);

  const filteredData = useMemo(() => {
    return currentData.filter(d => 
      (selectedIndustry === 'All' || d.industry === selectedIndustry) &&
      (selectedCategory === 'All' || d.category === selectedCategory)
    ).map(d => ({
      ...d,
      supplyScore: Math.min(5, d.supplyScore + simulateSupply),
      gap: Number((d.demandScore - Math.min(5, d.supplyScore + simulateSupply)).toFixed(2))
    }));
  }, [currentData, selectedIndustry, selectedCategory, simulateSupply]);

  // Aggregate skills for Quadrant and Bar charts
  const aggregatedSkills = useMemo(() => {
    const skillMap = new Map<string, { demand: number, supply: number, count: number, category: SkillCategory, premium: number }>();
    filteredData.forEach(d => {
      if (!skillMap.has(d.skillName)) {
        skillMap.set(d.skillName, { demand: 0, supply: 0, count: 0, category: d.category, premium: 0 });
      }
      const s = skillMap.get(d.skillName)!;
      s.demand += d.demandScore;
      s.supply += d.supplyScore;
      s.premium += d.premiumScore;
      s.count += 1;
    });

    return Array.from(skillMap.entries()).map(([name, data]) => ({
      name,
      category: data.category,
      demand: Number((data.demand / data.count).toFixed(2)),
      supply: Number((data.supply / data.count).toFixed(2)),
      premium: Number((data.premium / data.count).toFixed(2)),
      gap: Number(((data.demand - data.supply) / data.count).toFixed(2))
    }));
  }, [filteredData]);

  // WAISx Score Components
  const { waisxScore, demandIndex, supplyIndex, gapSeverity } = useMemo(() => {
    if (filteredData.length === 0) return { waisxScore: 0, demandIndex: 0, supplyIndex: 0, gapSeverity: 0 };
    
    const totalWeight = filteredData.reduce((acc, curr) => acc + curr.waisxWeight, 0);
    const avgDemand = filteredData.reduce((acc, curr) => acc + curr.demandScore * curr.waisxWeight, 0) / totalWeight;
    const avgSupply = filteredData.reduce((acc, curr) => acc + curr.supplyScore * curr.waisxWeight, 0) / totalWeight;
    
    const dIndex = (avgDemand / 5) * 100;
    const sIndex = (avgSupply / 5) * 100;
    const score = Math.min(100, Math.max(0, (sIndex / dIndex) * 100));
    const severity = Math.max(0, dIndex - sIndex);

    return {
      waisxScore: score,
      demandIndex: dIndex,
      supplyIndex: sIndex,
      gapSeverity: severity
    };
  }, [filteredData]);

  // Industry WAISx Comparison
  const industryScores = useMemo(() => {
    const industries: Industry[] = ['IT & AI', 'BFSI', 'Healthcare', 'Manufacturing', 'Education', 'Aviation & Smart Cities'];
    return industries.map(ind => {
      const indData = currentData.filter(d => d.industry === ind);
      const totalWeight = indData.reduce((acc, curr) => acc + curr.waisxWeight, 0);
      if (totalWeight === 0) return { industry: ind, score: 0 };
      const avgDemand = indData.reduce((acc, curr) => acc + curr.demandScore * curr.waisxWeight, 0) / totalWeight;
      const avgSupply = indData.reduce((acc, curr) => acc + (curr.supplyScore + simulateSupply) * curr.waisxWeight, 0) / totalWeight;
      const score = Math.min(100, Math.max(0, (avgSupply / avgDemand) * 100));
      return { industry: ind, score: Number(score.toFixed(1)) };
    }).sort((a, b) => b.score - a.score);
  }, [currentData, simulateSupply]);

  // Strategic Insights Generation
  const insights = useMemo(() => {
    const generated = [];
    const sortedByGap = [...aggregatedSkills].sort((a, b) => b.gap - a.gap);
    const topGap = sortedByGap[0];
    
    if (topGap) {
      generated.push({
        type: 'critical',
        text: `${topGap.name} shows a critical shortage (Gap: +${topGap.gap}) across selected sectors.`,
        action: `Universities should introduce specialized tracks in ${topGap.name}.`
      });
    }

    const sortedByPremium = [...aggregatedSkills].sort((a, b) => b.premium - a.premium);
    const topPremium = sortedByPremium[0];
    if (topPremium) {
      generated.push({
        type: 'opportunity',
        text: `${topPremium.name} commands the highest market premium (Index: ${topPremium.premium}).`,
        action: `Companies should prioritize internal upskilling in ${topPremium.name} to retain talent.`
      });
    }

    if (waisxScore < 60) {
      generated.push({
        type: 'warning',
        text: `Overall WAISx score indicates a severe structural skill deficit.`,
        action: `Government intervention required for broad-based AI literacy programs.`
      });
    }

    return generated;
  }, [aggregatedSkills, waisxScore]);

  // Skill Transition Analysis (Q1 2025 vs Q1 2026)
  const transitions = useMemo(() => {
    const q1_25 = data.filter(d => d.timePeriod === 'Q1 2025');
    const q1_26 = data.filter(d => d.timePeriod === 'Q1 2026');
    
    const movements: any[] = [];
    const skills = Array.from(new Set(data.map(d => d.skillName)));
    
    skills.forEach(skill => {
      const oldData = q1_25.filter(d => d.skillName === skill);
      const newData = q1_26.filter(d => d.skillName === skill);
      
      if (oldData.length && newData.length) {
        const oldAvgD = oldData.reduce((acc, curr) => acc + curr.demandScore, 0) / oldData.length;
        const oldAvgS = oldData.reduce((acc, curr) => acc + curr.supplyScore, 0) / oldData.length;
        const newAvgD = newData.reduce((acc, curr) => acc + curr.demandScore, 0) / newData.length;
        const newAvgS = newData.reduce((acc, curr) => acc + curr.supplyScore, 0) / newData.length;
        
        const getQuad = (d: number, s: number) => {
          if (d > 3 && s > 3) return 'Sought & Rewarded';
          if (d > 3 && s <= 3) return 'Scarce & Undervalued';
          if (d <= 3 && s > 3) return 'Abundant & Rewarded';
          return 'Low Priority';
        };
        
        const oldQuad = getQuad(oldAvgD, oldAvgS);
        const newQuad = getQuad(newAvgD, newAvgS);
        
        if (oldQuad !== newQuad) {
          movements.push({ skill, from: oldQuad, to: newQuad });
        }
      }
    });
    return movements.slice(0, 4); // Top 4 movements
  }, [data]);

  // Quadrant Evolution Data
  const quadrantEvolution = useMemo(() => {
    const periods: TimePeriod[] = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'];
    return periods.map(period => {
      const periodData = data.filter(d => d.timePeriod === period);
      const counts = { period, 'Sought & Rewarded': 0, 'Scarce & Undervalued': 0, 'Abundant & Rewarded': 0, 'Low Priority': 0 };
      
      const skillMap = new Map<string, { demand: number, supply: number, count: number }>();
      periodData.forEach(d => {
        if (!skillMap.has(d.skillName)) skillMap.set(d.skillName, { demand: 0, supply: 0, count: 0 });
        const s = skillMap.get(d.skillName)!;
        s.demand += d.demandScore;
        s.supply += d.supplyScore;
        s.count += 1;
      });

      skillMap.forEach(s => {
        const avgD = s.demand / s.count;
        const avgS = s.supply / s.count;
        if (avgD > 3 && avgS > 3) counts['Sought & Rewarded']++;
        else if (avgD > 3 && avgS <= 3) counts['Scarce & Undervalued']++;
        else if (avgD <= 3 && avgS > 3) counts['Abundant & Rewarded']++;
        else counts['Low Priority']++;
      });
      
      return counts;
    });
  }, [data]);

  const handleExportPDF = async () => {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) return;
    
    try {
      const canvas = await html2canvas(dashboard, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('WAISx_Intelligence_Report.pdf');
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
      setIsAdmin(true);
      setAdminPassword('');
      setUploadError('');
    } else {
      setUploadError('Invalid password');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          if (Array.isArray(jsonData)) {
            setData(prev => [...prev, ...jsonData]);
            setUploadError('');
            alert('Data uploaded successfully!');
            setShowAdminModal(false);
          } else {
            setUploadError('JSON must be an array of SkillData objects.');
          }
        } catch (err) {
          setUploadError('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setUploadError('Error parsing CSV.');
            return;
          }
          setData(prev => [...prev, ...(results.data as SkillData[])]);
          setUploadError('');
          alert('Data uploaded successfully!');
          setShowAdminModal(false);
        }
      });
    } else {
      setUploadError('Please upload a .json or .csv file.');
    }
  };

  const renderCustomLabel = (props: any) => {
    const { x, y, name, gap } = props;
    // Only show label for skills with high gap or high surplus to avoid clutter
    if (gap > 1.2 || gap < -1.2) {
      return (
        <text x={x} y={y - 12} fill="#475569" fontSize={11} textAnchor="middle" fontWeight="600" className="pointer-events-none">
          {name}
        </text>
      );
    }
    return null;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-lg text-sm z-50 min-w-[200px]">
          <p className="font-bold text-slate-900 text-base border-b pb-2 mb-2">{data.name}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Category:</span>
              <span className="font-medium text-slate-700">{data.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Demand:</span>
              <span className="font-bold text-slate-900">{data.demand}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Supply:</span>
              <span className="font-bold text-slate-900">{data.supply}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Gap:</span>
              <span className={`font-bold ${data.gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {data.gap > 0 ? '+' : ''}{data.gap.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t mt-1">
              <span className="text-slate-500">Premium Index:</span>
              <span className="font-bold text-blue-600">{data.premium}</span>
            </div>
          </div>
          <p className="text-xs text-blue-500 mt-3 italic flex items-center gap-1">
            <Info className="w-3 h-3" /> Click for drill-down
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg shadow-inner">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl leading-tight text-slate-900 tracking-tight">WAISx 2026 Intelligence</h1>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">National AI Skills Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
              <div className="flex items-center gap-1.5" title="Data Confidence">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>High Confidence</span>
              </div>
              <div className="w-px h-4 bg-slate-300"></div>
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>N=12,450 Surveys</span>
              </div>
              <div className="w-px h-4 bg-slate-300"></div>
              <span>Updated: Today</span>
            </div>
            {isAdmin ? (
              <button onClick={() => setIsAdmin(false)} className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-md transition-colors">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            ) : (
              <button onClick={() => setShowAdminModal(true)} className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-md transition-colors">
                <Lock className="w-4 h-4" />
                Admin
              </button>
            )}
            <button onClick={handleExportPDF} className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition-colors shadow-sm">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </header>

      <main id="dashboard-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Control Panel */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-slate-500 mr-2">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider text-slate-700">Scope</span>
            </div>
            
            <select 
              className="bg-slate-50 border border-slate-200 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[160px]"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
            >
              <option value="Q1 2026">Q1 2026 (Current)</option>
              <option value="FY 2025">FY 2025 (Consolidated)</option>
              <option value="Q4 2025">Q4 2025</option>
              <option value="Q3 2025">Q3 2025</option>
              <option value="Q2 2025">Q2 2025</option>
              <option value="Q1 2025">Q1 2025</option>
              <option value="All Time">All Time</option>
            </select>

            <select 
              className="bg-slate-50 border border-slate-200 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[160px]"
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value as any)}
            >
              <option value="All">All Industries</option>
              <option value="IT & AI">IT & AI</option>
              <option value="BFSI">BFSI</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Education">Education</option>
              <option value="Aviation & Smart Cities">Aviation & Smart Cities</option>
            </select>

            <select 
              className="bg-slate-50 border border-slate-200 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[160px]"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
            >
              <option value="All">All Categories</option>
              <option value="AI & Technical">AI & Technical</option>
              <option value="Cognitive & Behavioral">Cognitive & Behavioral</option>
              <option value="Governance & Ethics">Governance & Ethics</option>
            </select>
          </div>

          {/* Scenario Simulation */}
          <div className="flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-900">Scenario Simulation:</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-700">Supply Boost:</span>
              <input 
                type="range" 
                min="0" max="2" step="0.1" 
                value={simulateSupply} 
                onChange={(e) => setSimulateSupply(parseFloat(e.target.value))}
                className="w-24 accent-blue-600"
              />
              <span className="text-sm font-bold text-blue-700 w-8">+{simulateSupply.toFixed(1)}</span>
            </div>
          </div>
        </section>

        {/* Top KPIs & Strategic Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Score Cards */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900 rounded-bl-full -z-10 opacity-5"></div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">WAISx Index Score</p>
              <div className="flex items-end gap-3 mb-4">
                <h2 className="text-5xl font-black text-slate-900 tracking-tight">{waisxScore.toFixed(1)}</h2>
                <span className="text-lg text-slate-500 font-medium mb-1">/ 100</span>
              </div>
              
              {/* Benchmark Band */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2 flex">
                <div className="h-full bg-rose-500" style={{ width: '40%' }}></div>
                <div className="h-full bg-amber-400" style={{ width: '30%' }}></div>
                <div className="h-full bg-emerald-500" style={{ width: '30%' }}></div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Critical (0-40)</span>
                <span>Moderate (40-70)</span>
                <span>Healthy (70-100)</span>
              </div>
              
              <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Demand Index</p>
                  <p className="text-lg font-bold text-slate-800">{demandIndex.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Supply Index</p>
                  <p className="text-lg font-bold text-slate-800">{supplyIndex.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Insights */}
          <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">Strategic Intelligence</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {insights.map((insight, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${
                  insight.type === 'critical' ? 'bg-rose-50 border-rose-100' : 
                  insight.type === 'opportunity' ? 'bg-blue-50 border-blue-100' : 
                  'bg-amber-50 border-amber-100'
                }`}>
                  <div className="flex items-start gap-3">
                    {insight.type === 'critical' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                    {insight.type === 'opportunity' && <TrendingUp className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
                    {insight.type === 'warning' && <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-sm font-bold text-slate-900 mb-2">{insight.text}</p>
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t border-black/5">
                        <ArrowRight className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-slate-700">{insight.action}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Dashboard Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quadrant Matrix (Takes 2 columns) */}
          <section className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Skills Quadrant Matrix</h3>
                <p className="text-sm text-slate-500">Click any skill for deep-dive drill-down analysis.</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div> AI & Tech</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Cognitive</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Governance</div>
              </div>
            </div>
            
            <div className="h-[500px] w-full relative flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart 
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      setSelectedSkill(e.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="supply" name="Supply Score" domain={[1, 5]} tickCount={5} label={{ value: 'Supply Score (1-5)', position: 'insideBottom', offset: -10 }} />
                  <YAxis type="number" dataKey="demand" name="Demand Score" domain={[1, 5]} tickCount={5} label={{ value: 'Demand Score (1-5)', angle: -90, position: 'insideLeft' }} />
                  <ZAxis type="number" range={[150, 150]} />
                  
                  {/* @ts-ignore */}
                  <ReferenceArea x1={1} x2={3} y1={1} y2={3} fill="#fef3c7" fillOpacity={0.3}>
                    <Label value="Low Priority" position="insideBottomLeft" fill="#d97706" fontSize={14} fontWeight={600} offset={15} />
                  </ReferenceArea>
                  {/* @ts-ignore */}
                  <ReferenceArea x1={1} x2={3} y1={3} y2={5} fill="#ffe4e6" fillOpacity={0.3}>
                    <Label value="Scarce & Undervalued" position="insideTopLeft" fill="#be123c" fontSize={14} fontWeight={600} offset={15} />
                  </ReferenceArea>
                  {/* @ts-ignore */}
                  <ReferenceArea x1={3} x2={5} y1={1} y2={3} fill="#d1fae5" fillOpacity={0.3}>
                    <Label value="Abundant & Rewarded" position="insideBottomRight" fill="#047857" fontSize={14} fontWeight={600} offset={15} />
                  </ReferenceArea>
                  {/* @ts-ignore */}
                  <ReferenceArea x1={3} x2={5} y1={3} y2={5} fill="#dbeafe" fillOpacity={0.3}>
                    <Label value="Sought & Rewarded" position="insideTopRight" fill="#1d4ed8" fontSize={14} fontWeight={600} offset={15} />
                  </ReferenceArea>
                  
                  <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="3 3" />
                  <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="3 3" />

                  <RechartsTooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter 
                    name="Skills" 
                    data={aggregatedSkills} 
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      const skillData = data?.payload || data;
                      if (skillData && skillData.name) {
                        setSelectedSkill(skillData);
                      }
                    }}
                  >
                    <LabelList dataKey="name" content={renderCustomLabel} />
                    {aggregatedSkills.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[entry.category]} 
                        stroke={selectedSkill?.name === entry.name ? '#0f172a' : 'none'}
                        strokeWidth={selectedSkill?.name === entry.name ? 3 : 0}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Right Column: Industry Ranking & Transitions */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Industry WAISx Comparison */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Industry Readiness Ranking</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryScores} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="industry" type="category" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                      {industryScores.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score > 70 ? '#10b981' : entry.score > 40 ? '#f59e0b' : '#e11d48'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Skill Transition Analysis */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1">
              <h3 className="text-base font-bold text-slate-900 mb-1">Skill Transitions</h3>
              <p className="text-xs text-slate-500 mb-4">Movement from Q1 '25 to Q1 '26</p>
              
              <div className="space-y-4">
                {transitions.map((t, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-slate-800">{t.skill}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded truncate max-w-[120px]">{t.from}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className={`px-2 py-1 rounded font-medium truncate max-w-[120px] ${
                        t.to === 'Sought & Rewarded' ? 'bg-blue-100 text-blue-700' :
                        t.to === 'Scarce & Undervalued' ? 'bg-rose-100 text-rose-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>{t.to}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Quadrant Evolution Chart */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1">
              <h3 className="text-base font-bold text-slate-900 mb-1">Quadrant Evolution</h3>
              <p className="text-xs text-slate-500 mb-4">Historical shift of skills across quadrants</p>
              
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={quadrantEvolution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="Sought & Rewarded" stackId="1" stroke="#1d4ed8" fill="#dbeafe" />
                    <Area type="monotone" dataKey="Scarce & Undervalued" stackId="1" stroke="#be123c" fill="#ffe4e6" />
                    <Area type="monotone" dataKey="Abundant & Rewarded" stackId="1" stroke="#047857" fill="#d1fae5" />
                    <Area type="monotone" dataKey="Low Priority" stackId="1" stroke="#d97706" fill="#fef3c7" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

          </div>
        </div>

        {/* Bottom Section: Premium Index & Drill-down */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Skill Premium Index (Bubble Chart) */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Skill Premium Index</h3>
            <p className="text-sm text-slate-500 mb-6">Bubble size represents salary premium. X=Demand, Y=Gap.</p>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart 
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      setSelectedSkill(e.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="demand" name="Demand" domain={[1, 5]} label={{ value: 'Demand Score', position: 'insideBottom', offset: -10 }} />
                  <YAxis type="number" dataKey="gap" name="Gap" label={{ value: 'Gap Severity', angle: -90, position: 'insideLeft' }} />
                  <ZAxis type="number" dataKey="premium" range={[50, 800]} name="Premium Index" />
                  <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-md text-sm">
                          <p className="font-bold text-slate-900">{data.name}</p>
                          <p className="text-slate-600">Premium Index: <span className="font-bold text-blue-600">{data.premium}</span></p>
                          <p className="text-slate-600">Gap: {data.gap}</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Scatter 
                    name="Premium" 
                    data={aggregatedSkills} 
                    fill="#8b5cf6" 
                    opacity={0.6}
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      const skillData = data?.payload || data;
                      if (skillData && skillData.name) {
                        setSelectedSkill(skillData);
                      }
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Interactive Skill Drill-down */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Interactive Skill Drill-down</h3>
            <p className="text-sm text-slate-500 mb-6">Select a skill from the Quadrant Matrix to view details.</p>
            
            {selectedSkill ? (
              <div className="flex-1 flex flex-col animate-in fade-in">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-2xl font-black text-slate-900">{selectedSkill.name}</h4>
                    <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md mt-2 uppercase tracking-wider">
                      {selectedSkill.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500 uppercase tracking-wider font-bold mb-1">Premium Index</p>
                    <p className="text-3xl font-black text-blue-600">{selectedSkill.premium}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Demand</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedSkill.demand}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Supply</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedSkill.supply}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${selectedSkill.gap > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className="text-xs uppercase tracking-wider font-bold mb-1 opacity-70">Gap Severity</p>
                    <p className="text-2xl font-bold">{selectedSkill.gap > 0 ? '+' : ''}{selectedSkill.gap}</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mt-auto">
                  <h5 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Recommended Action
                  </h5>
                  <p className="text-sm text-blue-800">
                    {selectedSkill.gap > 1 
                      ? `Critical priority for Academic institutions to introduce specialized tracks. Industry should focus on aggressive upskilling programs to bridge the ${selectedSkill.gap} gap.`
                      : selectedSkill.demand > 3 
                      ? `Maintain current training pipelines. High demand is currently met by adequate supply, but requires continuous monitoring.`
                      : `Low immediate priority. Reallocate training resources to higher-gap skills while monitoring market shifts.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Click a dot in the Quadrant Matrix</p>
                <p className="text-xs mt-1">to unlock deep-dive intelligence</p>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Admin Login / Upload Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                {isAdmin ? <Upload className="w-5 h-5 text-blue-600" /> : <Lock className="w-5 h-5 text-slate-600" />}
                {isAdmin ? 'Upload Data' : 'Admin Authentication'}
              </h3>
              <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {!isAdmin ? (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input 
                      type="password" 
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter admin password (admin123)"
                      autoFocus
                    />
                  </div>
                  {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
                  <button type="submit" className="w-full bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800 transition-colors">
                    Login
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Upload new skill data in JSON or CSV format to update the dashboard.</p>
                  
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                    <input 
                      type="file" 
                      accept=".json,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 mt-1">JSON or CSV files only</p>
                  </div>
                  
                  {uploadError && <p className="text-sm text-rose-600 text-center">{uploadError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
