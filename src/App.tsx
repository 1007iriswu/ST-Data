import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, TrendingUp, AlertCircle, Table as TableIcon, 
  LayoutGrid, ChevronDown, Plus, Trash2, Settings2, X, 
  Pencil, Save, PieChart, BarChart3, Filter, Search, FileSpreadsheet
} from 'lucide-react';

interface CMoneyData {
  Data: any[][];
  Title: string[];
}

interface EtfSource {
  name: string;
  label: string;
  isCustom?: boolean;
}

const DEFAULT_ETFS: EtfSource[] = [
  { name: "0050", label: "0050 元大台灣50" },
  { name: "0056", label: "0056 元大高股息" },
  { name: "00878", label: "00878 國泰永續高股息" },
  { name: "006208", label: "006208 富邦台50" },
  { name: "00713", label: "00713 元大台灣高息低波" },
  { name: "00881", label: "00881 國泰台灣5G+" },
  { name: "00692", label: "00692 富邦公司治理" },
  { name: "00850", label: "00850 元大臺灣ESG永續" },
  { name: "00915", label: "00915 凱基優選高股息30" },
  { name: "00919", label: "00919 群益台灣精選高息" },
  { name: "00929", label: "00929 復華台灣科技優息" },
  { name: "00757", label: "00757 統一FANG+" },
  { name: "00646", label: "00646 富邦標普500" },
  { name: "0052", label: "0052 富邦科技" }
];

type TabType = 'etf' | 'stock' | 'filter';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('etf');
  const [etfs, setEtfs] = useState<EtfSource[]>(() => {
    const saved = localStorage.getItem('cmoney_etf_sources');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_ETFS;
      }
    }
    return DEFAULT_ETFS;
  });

  const [selectedEtf, setSelectedEtf] = useState(etfs[0]?.name || "0050");
  const [data, setData] = useState<CMoneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showSettings, setShowSettings] = useState(false);
  
  // ETF form state
  const [newEtfName, setNewEtfName] = useState('');
  const [newEtfLabel, setNewEtfLabel] = useState('');
  const [editingEtf, setEditingEtf] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter state
  const [filterText, setFilterText] = useState('');
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    localStorage.setItem('cmoney_etf_sources', JSON.stringify(etfs));
  }, [etfs]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        setIsAuthenticated(data.isAuthenticated);
      } catch (e) {
        console.error('Auth check failed', e);
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  // Listen for OAuth success
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        // If we were in the middle of exporting, trigger it now
        if (isExportingSheet) {
          handleExportToGoogleSheet();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isExportingSheet]);

  // Clear form error when inputs change
  useEffect(() => {
    setFormError(null);
  }, [newEtfName, newEtfLabel]);

  const fetchData = async (etfCode: string) => {
    if (!etfCode) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cmoney-data?etf=${etfCode}`);
      if (!response.ok) throw new Error(`Failed to fetch data for ${etfCode}`);
      const result = await response.json();
      
      if (!result || !Array.isArray(result.Title) || !Array.isArray(result.Data)) {
        throw new Error('Invalid data format received from API');
      }
      
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const [showGasGuide, setShowGasGuide] = useState(false);

  const handleExportToGoogleSheet = async () => {
    if (!data) return;
    
    setIsExportingSheet(true);
    
    try {
      // Perform export via GAS (Server-side proxy)
      const etfLabel = etfs.find(e => e.name === selectedEtf)?.label || selectedEtf;
      const res = await fetch('/api/export/google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${etfLabel} 持股資料 - ${new Date().toLocaleDateString()}`,
          data: data
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.error === '尚未設定 GAS 網址') {
          setShowGasGuide(true);
          return;
        }
        throw new Error(errorData.error || 'Export failed');
      }

      const result = await res.json();
      if (result.success && result.url) {
        window.open(result.url, '_blank');
      } else {
        throw new Error('GAS returned an unsuccessful response');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '匯出失敗，請稍後再試。');
      console.error(err);
    } finally {
      setIsExportingSheet(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'etf') {
      fetchData(selectedEtf);
    }
  }, [selectedEtf, activeTab]);

  const handleSubmitEtf = (e: FormEvent) => {
    e.preventDefault();
    if (!newEtfName || !newEtfLabel) return;
    
    const trimmedName = newEtfName.trim();
    const trimmedLabel = newEtfLabel.trim();

    if (editingEtf) {
      if (etfs.some(e => e.name.toLowerCase() === trimmedName.toLowerCase() && e.name !== editingEtf)) {
        setFormError(`代號 "${trimmedName}" 已存在，請使用其他代號。`);
        return;
      }

      const updated = etfs.map(e => 
        e.name === editingEtf ? { ...e, name: trimmedName, label: trimmedLabel } : e
      );
      setEtfs(updated);
      
      if (selectedEtf === editingEtf) {
        setSelectedEtf(trimmedName);
      }
      
      setEditingEtf(null);
    } else {
      if (etfs.some(e => e.name.toLowerCase() === trimmedName.toLowerCase())) {
        setFormError(`代號 "${trimmedName}" 已存在，請使用其他代號。`);
        return;
      }

      const newSource: EtfSource = {
        name: trimmedName,
        label: trimmedLabel,
        isCustom: true
      };

      setEtfs([...etfs, newSource]);
    }

    setNewEtfName('');
    setNewEtfLabel('');
    setFormError(null);
  };

  const startEditing = (etf: EtfSource) => {
    setEditingEtf(etf.name);
    setNewEtfName(etf.name);
    setNewEtfLabel(etf.label);
    setFormError(null);
  };

  const cancelEditing = () => {
    setEditingEtf(null);
    setNewEtfName('');
    setNewEtfLabel('');
    setFormError(null);
  };

  const handleRemoveEtf = (name: string) => {
    if (etfs.length <= 1) return;
    const updated = etfs.filter(e => e.name !== name);
    setEtfs(updated);
    if (selectedEtf === name) {
      setSelectedEtf(updated[0].name);
    }
    if (editingEtf === name) {
      cancelEditing();
    }
  };

  const handleResetDefaults = () => {
    if (confirm('確定要重置為預設列表嗎？您的自定義來源將被移除。')) {
      setEtfs(DEFAULT_ETFS);
      setSelectedEtf(DEFAULT_ETFS[0].name);
      cancelEditing();
    }
  };

  const filteredData = data ? {
    ...data,
    Data: data.Data.filter(row => 
      row.some(cell => String(cell).toLowerCase().includes(filterText.toLowerCase()))
    )
  } : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-emerald-600" />
              CMoney Data Viewer
            </h1>
            <p className="text-slate-500 mt-1">
              {activeTab === 'etf' ? 'Real-time financial data for Taiwan ETFs' : 
               activeTab === 'stock' ? 'Individual stock analysis and data' : 
               'Advanced filtering and screening'}
            </p>
          </div>
          
          {activeTab === 'etf' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative min-w-[200px]">
                  <label htmlFor="etf-select" className="sr-only">Select ETF</label>
                  <div className="relative">
                    <select
                      id="etf-select"
                      value={selectedEtf}
                      onChange={(e) => setSelectedEtf(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-10 font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      {etfs.map((etf) => (
                        <option key={etf.name} value={etf.name}>
                          {etf.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>
                
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg border transition-all ${showSettings ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm'}`}
                  title="Manage Sources"
                >
                  <Settings2 size={20} />
                </button>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-1 flex shadow-sm">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Table View"
                >
                  <TableIcon size={20} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Grid View"
                >
                  <LayoutGrid size={20} />
                </button>
              </div>
              
              <button
                onClick={handleExportToGoogleSheet}
                disabled={loading || isExportingSheet || !data}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md active:scale-95 disabled:opacity-50"
                title="匯出至 Google Sheet"
              >
                <FileSpreadsheet size={18} className={isExportingSheet ? 'animate-pulse' : ''} />
                {isExportingSheet ? '匯出中...' : 'Sheet'}
              </button>
              
              <button
                onClick={() => fetchData(selectedEtf)}
                disabled={loading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          )}
        </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && activeTab === 'etf' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Settings2 size={20} className="text-emerald-600" />
                    Manage Data Sources
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      {editingEtf ? '編輯 ETF' : '新增自定義 ETF'}
                    </h4>
                    <form onSubmit={handleSubmitEtf} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ETF 代號 (例如: 0050)</label>
                        <input
                          type="text"
                          required
                          value={newEtfName}
                          onChange={(e) => setNewEtfName(e.target.value)}
                          placeholder="輸入代號"
                          className={`w-full bg-slate-50 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 transition-all ${formError ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500'}`}
                        />
                        {formError && (
                          <motion.p 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"
                          >
                            <AlertCircle size={12} />
                            {formError}
                          </motion.p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">顯示名稱</label>
                        <input
                          type="text"
                          required
                          value={newEtfLabel}
                          onChange={(e) => setNewEtfLabel(e.target.value)}
                          placeholder="輸入名稱"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2 rounded-lg font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                          {editingEtf ? <Save size={18} /> : <Plus size={18} />}
                          {editingEtf ? '儲存變更' : '新增來源'}
                        </button>
                        {editingEtf && (
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 transition-all"
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">目前來源</h4>
                      <button
                        onClick={handleResetDefaults}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                      >
                        重置為預設
                      </button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {etfs.map((etf) => (
                        <div 
                          key={etf.name} 
                          className={`flex items-center justify-between p-3 rounded-lg group transition-colors ${editingEtf === etf.name ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-transparent'}`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{etf.label}</span>
                            <span className="text-xs text-slate-400">代號: {etf.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditing(etf)}
                              className="text-slate-300 hover:text-emerald-600 p-1 transition-colors"
                              title="編輯來源"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleRemoveEtf(etf.name)}
                              disabled={etfs.length <= 1}
                              className="text-slate-300 hover:text-red-500 p-1 transition-colors disabled:opacity-0"
                              title="移除來源"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main>
          <AnimatePresence mode="wait">
            {activeTab === 'etf' ? (
              <motion.div
                key="etf-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {loading && !data ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium">正在獲取 {selectedEtf} 的最新數據...</p>
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex items-start gap-4">
                    <div className="bg-red-100 p-2 rounded-full text-red-600">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-red-900 font-bold text-lg">數據加載錯誤</h3>
                      <p className="text-red-700 mt-1">{error}</p>
                      <button
                        onClick={() => fetchData(selectedEtf)}
                        className="mt-4 text-red-600 font-semibold hover:underline"
                      >
                        重試
                      </button>
                    </div>
                  </div>
                ) : data ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-800">
                        {etfs.find(e => e.name === selectedEtf)?.label} 
                        <span className="ml-2 text-sm font-normal text-slate-400">({data.Data.length} 條記錄)</span>
                      </h2>
                    </div>

                    {viewMode === 'table' ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-bottom border-slate-200">
                                {data.Title.map((header, idx) => (
                                  <th key={idx} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {data.Data.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                                  {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.Data.map((row, rowIdx) => (
                          <motion.div
                            key={rowIdx}
                            whileHover={{ y: -4 }}
                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded">
                                記錄 #{rowIdx + 1}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {row.map((cell, cellIdx) => (
                                <div key={cellIdx} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0">
                                  <span className="text-xs font-medium text-slate-400 uppercase">{data.Title[cellIdx]}</span>
                                  <span className="text-sm font-semibold text-slate-700">{cell}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </motion.div>
            ) : activeTab === 'stock' ? (
              <motion.div
                key="stock-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm"
              >
                <BarChart3 size={48} className="text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-800">個股分析功能</h3>
                <p className="text-slate-500 mt-2">此功能正在開發中，敬請期待！</p>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl px-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-50 rounded-xl border border-dashed border-slate-200 animate-pulse" />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="filter-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="搜尋持股名稱、比例或代號..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                      找到 {filteredData?.Data.length || 0} 筆結果
                    </div>
                  </div>

                  {!data ? (
                    <div className="text-center py-12 text-slate-400">
                      請先在 ETF 分頁選擇一個標的
                    </div>
                  ) : filteredData && filteredData.Data.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-bottom border-slate-200">
                            {data.Title.map((header, idx) => (
                              <th key={idx} className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredData.Data.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-6 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Filter size={48} className="text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-500">沒有符合條件的結果</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="text-center text-slate-400 text-xs py-8">
          數據由 CMoney API 提供 • 最後更新: {new Date().toLocaleString()}
        </footer>
      </div>

      {/* GAS Setup Guide Modal */}
      <AnimatePresence>
        {showGasGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                <h3 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" />
                  設定 Google Apps Script (GAS)
                </h3>
                <button onClick={() => setShowGasGuide(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
                    您尚未設定 GAS 網址。請按照以下步驟完成設定，才能使用匯出至 Google Sheet 的功能。
                  </p>
                </div>

                <section className="space-y-3">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                    建立 GAS 專案
                  </h4>
                  <p className="text-sm text-slate-600 ml-8">
                    前往 <a href="https://script.google.com/" target="_blank" rel="noreferrer" className="text-emerald-600 underline">Google Apps Script</a> 並建立新專案。
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                    貼入程式碼
                  </h4>
                  <div className="ml-8 bg-slate-900 rounded-lg p-4 relative group">
                    <pre className="text-xs text-emerald-400 overflow-x-auto">
{`function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var title = payload.title;
    var data = payload.data;
    var ss = SpreadsheetApp.create(title);
    var sheet = ss.getSheets()[0];
    if (data.Title) sheet.appendRow(data.Title);
    if (data.Data && data.Data.length > 0) {
      sheet.getRange(2, 1, data.Data.length, data.Data[0].length).setValues(data.Data);
    }
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold").setBackground("#f3f3f3");
    return ContentService.createTextOutput(JSON.stringify({ success: true, url: ss.getUrl() })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                    </pre>
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                    部署為網頁應用程式
                  </h4>
                  <ul className="text-sm text-slate-600 ml-8 list-disc space-y-1">
                    <li>點擊 <b>「部署」 &gt; 「新部署」</b></li>
                    <li>類型選取 <b>「網頁應用程式」</b></li>
                    <li>執行身分：<b>「我」</b></li>
                    <li>誰有權限存取：<b>「所有人」</b></li>
                    <li>點擊部署並複製產生的 <b>「網頁應用程式網址」</b></li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                    設定環境變數
                  </h4>
                  <p className="text-sm text-slate-600 ml-8">
                    回到 AI Studio 的 <b>Settings &gt; Environment Variables</b>，新增 <b>GAS_WEB_APP_URL</b> 並貼上網址。
                  </p>
                </section>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowGasGuide(false)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold transition-all"
                >
                  我已完成設定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-3 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={() => setActiveTab('etf')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'etf' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeTab === 'etf' ? 'bg-emerald-50' : ''}`}>
              <PieChart size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">ETF</span>
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stock' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeTab === 'stock' ? 'bg-emerald-50' : ''}`}>
              <BarChart3 size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">個股</span>
          </button>

          <button
            onClick={() => setActiveTab('filter')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'filter' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeTab === 'filter' ? 'bg-emerald-50' : ''}`}>
              <Filter size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">篩選</span>
          </button>
        </div>
      </nav>
    </div>
  );
}


