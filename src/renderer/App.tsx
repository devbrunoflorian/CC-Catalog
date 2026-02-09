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
    X
} from 'lucide-react';

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

const App: React.FC = () => {
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<CCItem[]>([]);
    const [credits, setCredits] = useState<Creator[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [reportText, setReportText] = useState('');
    const [copying, setCopying] = useState(false);

    // Creator Editing State
    const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
    const [editForm, setEditForm] = useState({ patreon_url: '', website_url: '' });

    const loadCredits = async () => {
        const data = await (window as any).electron.invoke('get-credits');
        setCredits(data);
    };

    useEffect(() => {
        loadCredits();
    }, []);

    const handleScan = async () => {
        setScanning(true);
        try {
            const data = await (window as any).electron.invoke('scan-zip');
            if (data) {
                setResults(data);
                loadCredits();
            }
        } catch (error) {
            console.error('Scan failed:', error);
        } finally {
            setScanning(false);
        }
    };

    const handleGenerateReport = async () => {
        const text = await (window as any).electron.invoke('generate-report');
        setReportText(text);
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

    return (
        <div className="min-h-screen bg-bg-dark text-slate-200 flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border-subtle bg-bg-card flex flex-col p-6 shadow-xl z-10 text-slate-400">
                <div className="flex items-center gap-3 mb-10 px-2 text-slate-200">
                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                        <Package className="text-white w-6 h-6" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">Simscredit</span>
                </div>

                <nav className="space-y-2 flex-grow">
                    <button className="w-full flex items-center gap-3 px-4 py-3 bg-brand-primary/10 text-brand-secondary rounded-xl font-medium transition-all">
                        <Package size={20} />
                        Dashboard
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:text-slate-200 hover:bg-white/5 rounded-xl font-medium transition-all">
                        <CreditCard size={20} />
                        Creators
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:text-slate-200 hover:bg-white/5 rounded-xl font-medium transition-all">
                        <History size={20} />
                        History
                    </button>
                </nav>

                <div className="pt-6 border-t border-border-subtle">
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:text-slate-200 rounded-xl font-medium transition-all">
                        <Settings size={20} />
                        Settings
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
                            onClick={handleGenerateReport}
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
                                        {credits.map((creator) => (
                                            <div key={creator.id} className="bg-bg-card border border-border-subtle rounded-2xl p-5 hover-lift">
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
                                                            <span className="text-[10px] text-slate-600 font-mono ml-auto">{set.items.length} ITM</span>
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
                                            <div className="flex items-center gap-2 text-green-400 text-sm font-bold mb-6 shrink-0">
                                                <CheckCircle2 size={18} />
                                                Successfully identified {results.length} items
                                            </div>
                                            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-grow pr-1">
                                                {results.map((item, idx) => (
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
            </main>

            {/* Edit Creator Modal */}
            {editingCreator && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
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

            {/* Report Modal */}
            {showReport && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
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
                                    className="px-10 py-5 bg-white/5 hover:bg-white/10 rounded-[1.25rem] font-bold text-slate-400 transition-all border border-white/5 hover:text-slate-200"
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

export default App;
