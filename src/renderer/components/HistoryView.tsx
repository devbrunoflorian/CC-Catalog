import React, { useState, useEffect } from 'react';
import { Clock, Calendar, FileArchive, CheckCircle2, AlertTriangle, Hash } from 'lucide-react';

interface ScanLog {
    id: string;
    scanDate: string;
    fileName: string;
    itemsFound: number;
    creatorsFound: number;
    status: string;
    scannedFiles?: string;
}

interface HistoryViewProps {
    onReport?: (log: ScanLog) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onReport }) => {
    const [history, setHistory] = useState<ScanLog[]>([]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const data = await (window as any).electron.invoke('get-history');
        setHistory(data);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this scan history?')) {
            await (window as any).electron.invoke('delete-history-item', id);
            loadHistory();
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-8 bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                <Clock className="text-brand-primary/80" />
                Scan History
            </h2>

            <div className="space-y-4">
                {history.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed backdrop-blur-sm">
                        No scan history available.
                    </div>
                ) : (
                    history.map((log) => (
                        <div key={log.id} className="relative group overflow-hidden bg-white/[0.03] backdrop-blur-md border border-border-subtle hover:border-brand-primary/30 rounded-2xl p-6 flex justify-between items-center transition-all duration-300 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-brand-primary/5 hover:-translate-y-1">
                            {/* Glass shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                            <div className="flex items-center gap-5 relative z-10">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${log.status === 'success' ? 'bg-green-500/10 text-green-400 shadow-green-500/10' : 'bg-red-500/10 text-red-400 shadow-red-500/10'}`}>
                                    {log.status === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 font-bold text-lg text-slate-100 group-hover:text-white transition-colors">
                                        <FileArchive size={18} className="text-brand-secondary opacity-80" />
                                        {log.fileName}
                                    </div>
                                    <div className="text-xs font-medium text-slate-500 flex items-center gap-2 mt-1.5 uppercase tracking-wide">
                                        <Calendar size={12} />
                                        {new Date(log.scanDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        <span className="opacity-50">•</span>
                                        {new Date(log.scanDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8 relative z-10">
                                <div className="flex gap-8 text-right mr-4 border-r border-white/10 pr-8">
                                    <div className="group/stat">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 opacity-70 group-hover/stat:opacity-100 transition-opacity">Items</div>
                                        <div className="text-2xl font-mono text-slate-200 group-hover/stat:text-brand-secondary transition-colors">{log.itemsFound}</div>
                                    </div>
                                    <div className="group/stat">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 opacity-70 group-hover/stat:opacity-100 transition-opacity">New Creators</div>
                                        <div className="text-2xl font-mono text-slate-200 group-hover/stat:text-brand-secondary transition-colors">{log.creatorsFound}</div>
                                    </div>
                                </div>

                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                    {/* Only show report button if scannedFiles data is available and meaningful (e.g. valid JSON string longer than empty array '[]') */}
                                    {log.scannedFiles && log.scannedFiles.length > 2 && (
                                        <button
                                            onClick={() => onReport && onReport(log)}
                                            className="p-2.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl transition-all hover:shadow-lg hover:shadow-brand-primary/20 active:scale-95"
                                            title="Generate Report"
                                        >
                                            <Hash size={18} />
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => handleDelete(log.id, e)}
                                        className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
                                        title="Delete History"
                                    >
                                        <AlertTriangle size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default HistoryView;
