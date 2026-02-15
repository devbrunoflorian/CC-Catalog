import React, { useState, useEffect } from 'react';
import {
    Package,
    Upload,
    Clipboard,
    ExternalLink,
    CreditCard,
    CheckCircle2,
    History,
    Settings,
    Search,
    X,
    AlertCircle,
    UserPlus,
    Link2,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';
import CreatorsView from './components/CreatorsView';
import HistoryView from './components/HistoryView';
import logo from './assets/logo.png';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import SettingsModal from './components/SettingsModal';
import ScanConfirmationModal from './components/ScanConfirmationModal';

interface CCItem {
    creatorName: string;
    setName: string;
    fileName: string;
}

interface Creator {
    id: string;
    name: string;
    patreon_url: string;
    website_url: string;
    sets: any[];
}

interface CreatorMatch {
    foundName: string;
    existingName?: string;
    existingId?: string;
    similarity: number;
    needsConfirmation: boolean;
}

interface ScanAnalysis {
    results: CCItem[];
    matches: CreatorMatch[];
    filePath?: string;
}

interface ScanLog {
    id: string;
    scanDate: string;
    itemsFound: number;
    creatorsFound: number;
    fileName: string;
    status: string;
    scannedFiles?: string;
}

const countTotalItems = (set: any, allSets: any[]): number => {
    let count = set.items?.length || 0;
    const children = allSets.filter(s => s.parentId === set.id || s.parent_id === set.id);
    children.forEach(child => {
        count += countTotalItems(child, allSets);
    });
    return count;
};

const DashboardContent: React.FC = () => {
    const { themeColor, opacity } = useTheme();
    const [showSettings, setShowSettings] = useState(false);
    const [currentView, setCurrentView] = useState<'dashboard' | 'creators' | 'history'>('dashboard');

    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<CCItem[]>([]);
    const [credits, setCredits] = useState<Creator[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [reportText, setReportText] = useState('');
    const [copying, setCopying] = useState(false);

    // Scan Confirmation State
    const [analysis, setAnalysis] = useState<ScanAnalysis | null>(null);
    const [pendingConfirmations, setPendingConfirmations] = useState<CreatorMatch[]>([]);

    // Creator Editing State
    const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
    const [editForm, setEditForm] = useState({ patreon_url: '', website_url: '' });

    const [history, setHistory] = useState<ScanLog[]>([]);

    const loadCredits = async () => {
        const data = await (window as any).electron.invoke('get-credits');
        setCredits(data);
    };

    const loadHistory = async () => {
        const data = await (window as any).electron.invoke('get-history');
        setHistory(data);
    };

    // State to trigger history refresh
    const [historyUpdateTrigger, setHistoryUpdateTrigger] = useState(0);

    useEffect(() => {
        loadCredits();
        loadHistory();
    }, [historyUpdateTrigger]);

    const handleScan = async () => {
        setScanning(true);
        try {
            const data = await (window as any).electron.invoke('scan-zip');
            if (data) {
                const { results: scanResults, matches, filePath } = data as ScanAnalysis & { filePath: string };

                // Always show the confirmation modal for safety
                setAnalysis({ results: scanResults, matches, filePath });
                setPendingConfirmations(matches.filter(m => m.needsConfirmation));
            }
        } catch (error) {
            console.error('Scan failed:', error);
        } finally {
            setScanning(false);
        }
    };

    const handleConfirmScan = async (finalAnalysis?: ScanAnalysis) => {
        const targetAnalysis = finalAnalysis || analysis;
        if (!targetAnalysis) return;

        await (window as any).electron.invoke('confirm-scan', {
            results: targetAnalysis.results,
            matches: targetAnalysis.matches,
            filePath: targetAnalysis.filePath // Pass stored file path
        });

        setResults(targetAnalysis.results);
        setAnalysis(null);
        setPendingConfirmations([]);
        loadCredits();
        setHistoryUpdateTrigger(prev => prev + 1); // Refresh history
    };



    const [showReportOptions, setShowReportOptions] = useState(false);

    interface ReportSource {
        type: 'library' | 'scan';
        contextName?: string; // e.g. "Library" or "MyZip.zip"
        items?: string[]; // list of filenames for scan context
    }

    const [reportSource, setReportSource] = useState<ReportSource>({ type: 'library', contextName: 'Full Library' });

    const [reportConfig, setReportConfig] = useState({
        includeCreators: true,
        includeSets: true,
        includeItems: true,
        includeCategory: true
    });

    const handleOpenReportOptions = (source: ReportSource = { type: 'library', contextName: 'Full Library' }) => {
        setReportSource(source);
        setShowReportOptions(true);
    };

    const handleGenerateReport = async () => {
        const config: any = { ...reportConfig };

        if (reportSource.type === 'scan' && reportSource.items) {
            config.filterFileNames = reportSource.items;
        }

        const text = await (window as any).electron.invoke('generate-report', config);
        setReportText(text);
        setShowReportOptions(false);
        setShowReport(true);
    };

    const handleUpdateCreator = async () => {
        if (!editingCreator) return;
        await (window as any).electron.invoke('update-creator', {
            id: editingCreator.id,
            ...editForm
        });
        setEditingCreator(null);
        loadCredits();
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(reportText);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
    };

    // Calculate background color based on theme
    const getBackgroundStyle = () => {
        const bgColors: Record<string, string> = {
            'obsidian': `rgba(10, 10, 12, ${opacity})`,
            'rose-quartz': `rgba(40, 10, 20, ${opacity})`,
            'sapphire': `rgba(10, 20, 40, ${opacity})`,
            'diamond': `rgba(240, 240, 255, ${opacity})`
        };

        const style: React.CSSProperties = {
            backgroundColor: bgColors[themeColor] || bgColors['obsidian'],
        };

        // Inject dynamic accent colors
        if (themeColor === 'rose-quartz') {
            document.documentElement.style.setProperty('--color-brand-primary', 'hsl(330, 81%, 60%)');
            document.documentElement.style.setProperty('--color-brand-secondary', 'hsl(330, 81%, 70%)');
        } else if (themeColor === 'sapphire') {
            document.documentElement.style.setProperty('--color-brand-primary', 'hsl(217, 91%, 60%)');
            document.documentElement.style.setProperty('--color-brand-secondary', 'hsl(217, 91%, 70%)');
        } else if (themeColor === 'diamond') {
            // For diamond, we might want a different primary color or keep it standard blue/purple
            document.documentElement.style.setProperty('--color-brand-primary', 'hsl(200, 90%, 60%)');
            document.documentElement.style.setProperty('--color-brand-secondary', 'hsl(200, 90%, 70%)');
        } else {
            // Reset to Obsidian/Default
            document.documentElement.style.setProperty('--color-brand-primary', 'hsl(262, 83%, 65%)');
            document.documentElement.style.setProperty('--color-brand-secondary', 'hsl(262, 83%, 75%)');
        }

        return style;
    };

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="h-screen text-slate-200 flex font-sans transition-colors duration-500 overflow-hidden" style={getBackgroundStyle()}>
            {/* Sidebar */}
            <aside
                className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} border-r border-border-subtle bg-bg-card/50 flex flex-col transition-all duration-300 shadow-xl z-20 text-slate-400 backdrop-blur-sm shrink-0`}
            >
                <div className={`flex items-center gap-3 mb-6 px-4 py-6 text-slate-200 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                    <img src={logo} alt="Logo" className="w-8 h-8 object-contain rounded-xl" />
                    {!isSidebarCollapsed && <span className="font-bold text-xl tracking-tight animate-in fade-in duration-200">CC Catalog</span>}
                </div>

                <div className="px-3 mb-2 flex justify-end">
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-1.5 rounded-lg transition-all duration-300 text-slate-400 hover:text-brand-secondary hover:bg-brand-primary/10 hover:shadow-[0_0_12px_hsl(var(--brand-primary)/0.4)]"
                        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        {/* Actually, let's use a proper Menu icon or Chevron */}
                    </button>
                </div>

                <nav className="space-y-2 flex-grow px-2">
                    <button
                        onClick={() => setCurrentView('dashboard')}
                        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl font-medium transition-all ${currentView === 'dashboard' ? 'bg-brand-primary/10 text-brand-secondary' : 'hover:text-slate-200 hover:bg-white/5'}`}
                        title={isSidebarCollapsed ? "Dashboard" : ""}
                    >
                        <Package size={20} />
                        {!isSidebarCollapsed && <span>Dashboard</span>}
                    </button>
                    <button
                        onClick={() => setCurrentView('creators')}
                        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl font-medium transition-all ${currentView === 'creators' ? 'bg-brand-primary/10 text-brand-secondary' : 'hover:text-slate-200 hover:bg-white/5'}`}
                        title={isSidebarCollapsed ? "Creators" : ""}
                    >
                        <CreditCard size={20} />
                        {!isSidebarCollapsed && <span>Creators</span>}
                    </button>
                    <button
                        onClick={() => setCurrentView('history')}
                        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl font-medium transition-all ${currentView === 'history' ? 'bg-brand-primary/10 text-brand-secondary' : 'hover:text-slate-200 hover:bg-white/5'}`}
                        title={isSidebarCollapsed ? "History" : ""}
                    >
                        <History size={20} />
                        {!isSidebarCollapsed && <span>History</span>}
                    </button>
                </nav>

                <div className="pt-6 border-t border-border-subtle p-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 hover:text-slate-200 rounded-xl font-medium transition-all hover:bg-white/5`}
                        title={isSidebarCollapsed ? "Settings" : ""}
                    >
                        <Settings size={20} />
                        {!isSidebarCollapsed && <span>Settings</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-20 border-b border-border-subtle px-8 flex items-center justify-between glass-effect shrink-0">
                    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl border border-white/5 w-96">
                        <Search size={18} className="text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search CC or Creators..."
                            className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-500"
                        />
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                if (history.length > 0) {
                                    const latest = history[0];
                                    let items: string[] = [];
                                    try {
                                        items = latest.scannedFiles ? JSON.parse(latest.scannedFiles) : [];
                                    } catch (e) {
                                        console.error('Failed to parse scanned files history', e);
                                    }
                                    handleOpenReportOptions({ type: 'scan', contextName: latest.fileName, items: items });
                                } else {
                                    alert('No scan history available to generate a report. Please scan a ZIP file first.');
                                }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-all"
                        >
                            <Clipboard size={18} />
                            Generate Report
                        </button>
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className={`px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20 ${scanning ? 'bg-slate-700 cursor-not-allowed' : 'bg-brand-primary hover:bg-brand-secondary active:scale-95'
                                }`}
                        >
                            <Upload size={18} />
                            {scanning ? 'Scanning...' : 'Scan ZIP'}
                        </button>
                    </div>
                </header>

                {/* Dashboard Grid */}
                {currentView === 'dashboard' && (
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-[1600px] mx-auto">
                            {/* Summary Column */}
                            <div className="xl:col-span-2 space-y-8">
                                <section>
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-brand-primary rounded-full" />
                                        Your CC Library
                                    </h2>

                                    {credits.length === 0 ? (
                                        <div className="glass-effect rounded-2xl p-20 text-center space-y-4 border-2 border-dashed border-white/5">
                                            <div className="w-20 h-20 bg-brand-primary/5 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <Package className="text-brand-primary w-10 h-10 opacity-40" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-300">Your library is empty</h3>
                                            <p className="text-slate-500 max-w-sm mx-auto">
                                                Scan your first ZIP file containing Custom Content to begin building your credits database.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {credits.map((creator: Creator) => (
                                                <div key={creator.id} className="bg-white/5 border border-border-subtle rounded-2xl p-5 hover-lift backdrop-blur-md">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-200">{creator.name}</h3>
                                                            <span className="text-xs text-brand-secondary font-medium uppercase tracking-widest leading-none">Creator</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingCreator(creator);
                                                                    setEditForm({
                                                                        patreon_url: creator.patreon_url || '',
                                                                        website_url: creator.website_url || ''
                                                                    });
                                                                }}
                                                                className="text-slate-500 hover:text-brand-primary transition-colors p-2 -m-2"
                                                                title="Edit Links"
                                                            >
                                                                <Settings size={18} />
                                                            </button>
                                                            {creator.patreon_url && (
                                                                <a
                                                                    href={creator.patreon_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-slate-500 hover:text-brand-primary transition-colors p-2 -m-2"
                                                                >
                                                                    <ExternalLink size={18} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {creator.sets.slice(0, 3).map((set: any) => (
                                                            <div key={set.id} className="flex items-center gap-2 text-slate-400 group">
                                                                <div className="w-1 h-1 bg-brand-primary/50 group-hover:bg-brand-primary transition-colors rounded-full" />
                                                                <span className="text-sm truncate">{set.name}</span>
                                                                <span className="text-[10px] text-slate-600 font-mono ml-auto">{countTotalItems(set, creator.sets)} ITM</span>
                                                            </div>
                                                        ))}
                                                        {creator.sets.length > 3 && (
                                                            <div className="text-xs text-slate-600 pl-3 pt-1">+ {creator.sets.length - 3} more sets</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>

                            {/* Recent Activity Column */}
                            <div>
                                <section className="sticky top-0">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                                        Last Scan Activity
                                    </h2>

                                    <div className="glass-effect rounded-2xl p-6 border border-border-subtle min-h-[500px] flex flex-col">
                                        {results.length === 0 ? (
                                            <div className="flex-grow flex flex-col items-center justify-center text-slate-600 italic">
                                                <History size={48} className="mb-4 opacity-5 shrink-0" />
                                                <span className="opacity-40">No recent scan activity</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col h-full overflow-hidden">
                                                <div className="flex items-center justify-between mb-6 shrink-0">
                                                    <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                                                        <CheckCircle2 size={18} />
                                                        Successfully identified {results.length} items
                                                    </div>
                                                    <button
                                                        onClick={() => handleOpenReportOptions({ type: 'scan', contextName: 'Last Scan', items: results.map((r: any) => r.fileName) })}
                                                        className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 transition-colors flex items-center gap-2 font-medium text-slate-300 hover:text-white"
                                                    >
                                                        <Clipboard size={14} />
                                                        Create Scan Report
                                                    </button>
                                                </div>
                                                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-grow pr-1">
                                                    {results.map((item: CCItem, idx: number) => (
                                                        <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-1 hover:bg-white/[0.08] transition-colors group">
                                                            <span className="text-[10px] text-brand-secondary font-bold uppercase tracking-wider">{item.creatorName}</span>
                                                            <span className="text-sm text-slate-300 truncate font-medium">{item.fileName}</span>
                                                            <span className="text-[10px] text-slate-600 mt-1">Set: {item.setName}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                )}

                {/* Creators View */}
                {currentView === 'creators' && (
                    <div className="p-8 overflow-hidden h-full">
                        <CreatorsView refreshTrigger={historyUpdateTrigger} />
                    </div>
                )}

                {/* History View */}
                {currentView === 'history' && (
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
                        <HistoryView
                            key={historyUpdateTrigger}
                            onReport={(log) => {
                                let items: string[] = [];
                                try {
                                    items = log.scannedFiles ? JSON.parse(log.scannedFiles) : [];
                                } catch (e) {
                                    console.error('Failed to parse scanned files history', e);
                                }

                                if (items.length === 0) {
                                    alert('No file details available for this historical scan.');
                                    return;
                                }

                                handleOpenReportOptions({
                                    type: 'scan',
                                    contextName: log.fileName,
                                    items: items
                                });
                            }}
                        />
                    </div>
                )}
            </main>

            {/* Modals */}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

            {/* Scan Confirmation Modal */}
            {analysis && (
                <ScanConfirmationModal
                    analysis={analysis}
                    creatorsList={credits}
                    onConfirm={handleConfirmScan}
                    onCancel={() => { setAnalysis(null); setPendingConfirmations([]); }}
                />
            )}

            {/* Edit Creator Modal */}
            {editingCreator && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={(e) => { if (e.target === e.currentTarget) setEditingCreator(null); }}
                >
                    <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-10 py-8 border-b border-border-subtle bg-white/5">
                            <h2 className="text-2xl font-black tracking-tight">Edit "{editingCreator.name}"</h2>
                            <p className="text-slate-500 text-sm mt-1">Update links to include in future reports.</p>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">Patreon URL</label>
                                <input
                                    type="text"
                                    className="w-full bg-bg-dark border border-white/5 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-brand-primary/50 transition-colors"
                                    placeholder="https://patreon.com/..."
                                    value={editForm.patreon_url}
                                    onChange={(e) => setEditForm({ ...editForm, patreon_url: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">Website / Blog URL</label>
                                <input
                                    type="text"
                                    className="w-full bg-bg-dark border border-white/5 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-brand-primary/50 transition-colors"
                                    placeholder="https://..."
                                    value={editForm.website_url}
                                    onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={handleUpdateCreator}
                                    className="flex-grow py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-primary/20 transition-all active:scale-[0.98]"
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => setEditingCreator(null)}
                                    className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-slate-400 transition-all border border-white/5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Options Modal */}
            {showReportOptions && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowReportOptions(false); }}
                >
                    <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-border-subtle bg-white/5 bg-gradient-to-r from-brand-primary/5 to-transparent shrink-0">
                            <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                                <Clipboard className="text-brand-primary" />
                                Report Generation
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Select a scan from your history to generate a report.
                            </p>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">

                            {/* Scan Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">Select Scan</label>
                                <select
                                    className="w-full bg-bg-dark border border-white/5 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-brand-primary/50 transition-colors"
                                    value={reportSource.contextName}
                                    onChange={(e) => {
                                        const selectedLog = history.find(h => h.fileName === e.target.value);
                                        if (selectedLog) {
                                            let items: string[] = [];
                                            try {
                                                items = selectedLog.scannedFiles ? JSON.parse(selectedLog.scannedFiles) : [];
                                            } catch (err) { console.error(err); }

                                            setReportSource({
                                                type: 'scan',
                                                contextName: selectedLog.fileName,
                                                items: items
                                            });
                                        }
                                    }}
                                >
                                    {history.map(log => (
                                        <option key={log.id} value={log.fileName}>
                                            {log.fileName} ({new Date(log.scanDate).toLocaleDateString()}) - {log.itemsFound} items
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Toggle Options */}
                            <div className="space-y-4">
                                <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:border-brand-primary/30 transition-all group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200 group-hover:text-brand-secondary transition-colors">Include Creators</span>
                                        <span className="text-xs text-slate-500">Show creator names with hyperlinks (if available)</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 accent-brand-primary rounded-lg"
                                        checked={reportConfig.includeCreators}
                                        onChange={e => setReportConfig({ ...reportConfig, includeCreators: e.target.checked })}
                                    />
                                </label>

                                <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:border-brand-primary/30 transition-all group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200 group-hover:text-brand-secondary transition-colors">Include Sets</span>
                                        <span className="text-xs text-slate-500">List sets under each creator with hyperlinks</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 accent-brand-primary rounded-lg"
                                        checked={reportConfig.includeSets}
                                        disabled={!reportConfig.includeCreators} // Typically sets belong to creators, but user might want flat list? Assuming hierarchy.
                                        onChange={e => setReportConfig({ ...reportConfig, includeSets: e.target.checked })}
                                    />
                                </label>

                                <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:border-brand-primary/30 transition-all group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200 group-hover:text-brand-secondary transition-colors">Include Set Items</span>
                                        <span className="text-xs text-slate-500">Detailed list of files within each set</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 accent-brand-primary rounded-lg"
                                        checked={reportConfig.includeItems}
                                        disabled={!reportConfig.includeSets}
                                        onChange={e => setReportConfig({ ...reportConfig, includeItems: e.target.checked })}
                                    />
                                </label>

                                <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:border-brand-primary/30 transition-all group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200 group-hover:text-brand-secondary transition-colors">Include Category</span>
                                        <span className="text-xs text-slate-500">Show category next to item name</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 accent-brand-primary rounded-lg"
                                        checked={reportConfig.includeCategory}
                                        disabled={!reportConfig.includeItems}
                                        onChange={e => setReportConfig({ ...reportConfig, includeCategory: e.target.checked })}
                                    />
                                </label>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-white/5">
                                <button
                                    onClick={handleGenerateReport}
                                    className="flex-grow py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Clipboard size={18} />
                                    Generate Report
                                </button>
                                <button
                                    onClick={() => setShowReportOptions(false)}
                                    className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-slate-400 transition-all border border-white/5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReport && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}
                >
                    <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-10 py-8 border-b border-border-subtle flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">Credit Report</h2>
                                <p className="text-slate-500 text-sm mt-1">Ready to copy and paste to your platform.</p>
                            </div>
                            <button
                                onClick={() => setShowReport(false)}
                                className="text-slate-500 hover:text-slate-200 p-2 hover:bg-white/5 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-10">
                            <div className="bg-bg-dark rounded-3xl p-8 border border-border-subtle mb-8 max-h-[40vh] overflow-y-auto custom-scrollbar shadow-inner relative group">
                                <pre className="whitespace-pre-wrap font-mono text-brand-secondary text-sm leading-relaxed p-2">
                                    {reportText}
                                </pre>
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-bold text-slate-500 bg-bg-card px-2 py-1 rounded-full uppercase tracking-widest border border-white/5">Markdown Format</span>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={copyToClipboard}
                                    className={`flex-grow flex items-center justify-center gap-3 py-5 rounded-[1.25rem] font-black uppercase tracking-widest text-sm transition-all active:scale-[0.98] ${copying ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-brand-primary hover:bg-brand-secondary text-white shadow-xl shadow-brand-primary/20 hover:shadow-brand-primary/30'
                                        }`}
                                >
                                    {copying ? (
                                        <>
                                            <CheckCircle2 size={20} />
                                            Copied to Clipboard!
                                        </>
                                    ) : (
                                        <>
                                            <Clipboard size={20} />
                                            Copy Markdown
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowReport(false)}
                                    className="px-10 py-5 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-slate-400 transition-all border border-white/5 hover:text-slate-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <DashboardContent />
        </ThemeProvider>
    );
};

export default App;
