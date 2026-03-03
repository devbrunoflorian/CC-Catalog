import React from 'react';
import { X, Check, ExternalLink, DownloadCloud } from 'lucide-react';
import { ThemeColor, useTheme } from '../context/ThemeContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { themeColor, setThemeColor, opacity, setOpacity } = useTheme();
    const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);
    const [updateProgress, setUpdateProgress] = React.useState<number>(0);
    const [appVersion, setAppVersion] = React.useState<string>('');

    // Snapshot State
    const [isGeneratingSnapshot, setIsGeneratingSnapshot] = React.useState(false);
    const [snapshotStatus, setSnapshotStatus] = React.useState<{ status: string, message: string } | null>(null);

    React.useEffect(() => {
        if (!isOpen) return;

        (window as any).electron.invoke('get-app-version').then(setAppVersion);

        const handleStatus = (_event: any, data: any) => {
            if (typeof data === 'string') {
                setUpdateStatus(data);
            } else if (data && data.status === 'ready') {
                setUpdateStatus('ready');
            } else if (data && data.message) {
                setUpdateStatus(data.message);
            }
        };
        const handleProgress = (_event: any, progress: number) => setUpdateProgress(progress);

        const handleAppStatus = (_event: any, data: any) => {
            if (isGeneratingSnapshot || data.status === 'checking') {
                setSnapshotStatus(data);
            }
        };

        (window as any).electron.on('update-status', handleStatus);
        (window as any).electron.on('update-progress', handleProgress);
        (window as any).electron.on('update-status', handleAppStatus); // Reuse update-status event for app-wide statuses

        return () => {
            (window as any).electron.removeAllListeners('update-status');
            (window as any).electron.removeAllListeners('update-progress');
        };
    }, [isOpen]);

    const handleInstallUpdate = () => {
        (window as any).electron.invoke('quit-and-install');
    };

    const handleGenerateSnapshot = async () => {
        setIsGeneratingSnapshot(true);
        setSnapshotStatus({ status: 'checking', message: 'Starting snapshot generation...' });

        try {
            const result = await (window as any).electron.invoke('generate-organized-snapshot');
            if (result.success) {
                alert(`Snapshot Generated Successfully!\n\nFiles Linked: ${result.metrics.successCount}\nFiles Skipped (Already Exist): ${result.metrics.skipCount}\nErrors: ${result.metrics.errorCount}`);
            } else if (result.message !== 'Source folder selection canceled.' && result.message !== 'Destination folder selection canceled.') {
                alert(`Error: ${result.message}`);
            }
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
        } finally {
            setIsGeneratingSnapshot(false);
            setSnapshotStatus(null);
        }
    };

    if (!isOpen) return null;

    const colors: { id: ThemeColor; name: string; hex: string }[] = [
        { id: 'obsidian', name: 'Obsidian', hex: '#1e1e1e' },
        { id: 'rose-quartz', name: 'Rose Quartz', hex: '#f472b6' }, // pink-400
        { id: 'sapphire', name: 'Sapphire', hex: '#60a5fa' }, // blue-400
        { id: 'diamond', name: 'Diamond', hex: '#f8fafc' }, // slate-50
    ];

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center px-8 py-6 border-b border-white/5 bg-white/5 shrink-0">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                        Appearance
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-grow">
                    {/* Theme Color */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium text-slate-300 uppercase tracking-wider block">Accent Tint</label>
                        <div className="grid grid-cols-2 gap-4">
                            {colors.map((color) => (
                                <button
                                    key={color.id}
                                    onClick={() => setThemeColor(color.id)}
                                    className={`relative p-4 rounded-xl border transition-all flex items-center justify-between group ${themeColor === color.id
                                        ? 'border-brand-primary bg-brand-primary/10 shadow-[0_0_20px_rgba(var(--brand-primary),0.2)]'
                                        : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 hover-lift'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded-full shadow-sm"
                                            style={{ backgroundColor: color.hex }}
                                        />
                                        <span className={`font-medium ${themeColor === color.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                            {color.name}
                                        </span>
                                    </div>
                                    {themeColor === color.id && <Check size={16} className="text-brand-primary" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Opacity Slider */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-300 uppercase tracking-wider block">Glass Opacity</label>
                            <span className="text-xs font-mono text-slate-500">{Math.round(opacity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.05"
                            value={opacity}
                            onChange={(e) => setOpacity(parseFloat(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary hover:accent-brand-secondary"
                        />
                        <p className="text-xs text-slate-500">Adjust the transparency of the application background to see the window effect.</p>
                    </div>

                    {/* Data Management */}
                    <div className="space-y-4 border-t border-white/5 pt-6">
                        <label className="text-sm font-medium text-slate-300 uppercase tracking-wider block">Library Management</label>
                        <div className="flex gap-4">
                            <button
                                onClick={async () => {
                                    const res = await (window as any).electron.invoke('export-csv');
                                    if (res.success) alert('Library exported successfully!');
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 px-4 text-sm font-medium text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 hover-glow"
                            >
                                <span>Export CSV</span>
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will update your library structure based on the CSV. Continue?')) return;
                                    const res = await (window as any).electron.invoke('import-csv');
                                    if (res.success) alert(`Library updated! ${res.count} lines processed.`);
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 px-4 text-sm font-medium text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 hover-glow"
                            >
                                <span>Import CSV</span>
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Export your library to edit organization in Excel, then import it back.
                            Format: Creator, P/W, Set, P/W, Items.
                        </p>

                        {/* Snapshot Feature */}
                        <div className="mt-4 p-4 border border-brand-primary/30 bg-brand-primary/5 rounded-xl space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-brand-secondary">Organized Snapshot</h4>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        Create a perfectly organized copy of your Mods folder using <span className="text-slate-200 font-bold">Hard Links</span>.
                                        This takes <span className="text-slate-200 font-bold">0 extra space</span> and <span className="text-slate-200 font-bold">does NOT break CurseForge</span>!
                                        <br />
                                        <span className="text-[10px] text-slate-500 opacity-70">Note: Destination and Mods folder must be on the same drive.</span>
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateSnapshot}
                                disabled={isGeneratingSnapshot}
                                className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${isGeneratingSnapshot
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-brand-primary hover:bg-brand-secondary text-white shadow-lg shadow-brand-primary/20 hover-glow'
                                    }`}
                            >
                                <DownloadCloud size={16} />
                                {isGeneratingSnapshot ? 'Generating...' : 'Generate Snapshot Folder'}
                            </button>

                            {isGeneratingSnapshot && snapshotStatus?.message && (
                                <div className="text-center text-xs text-brand-secondary animate-pulse mt-2">
                                    {snapshotStatus.message}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* About Section */}
                    <div className="space-y-4 border-t border-white/5 pt-6 pb-2">
                        <label className="text-sm font-medium text-slate-300 uppercase tracking-wider block text-center">About CC Catalog</label>
                        <div className="glass-effect rounded-2xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Author</span>
                                    <span className="text-sm font-bold text-slate-200">Bruno Florian</span>
                                </div>
                                <a
                                    href="https://github.com/devbrunoflorian"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 bg-white/5 hover:bg-brand-primary/20 text-slate-400 hover:text-brand-secondary rounded-lg transition-all border border-white/5 hover-glow"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Co-authored by</span>
                                    <span className="text-sm font-bold text-slate-200">Violetsimmer7</span>
                                </div>
                                <a
                                    href="https://www.patreon.com/cw/Violetsimmer7"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 bg-white/5 hover:bg-brand-primary/20 text-slate-400 hover:text-brand-secondary rounded-lg transition-all border border-white/5 hover-glow"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            </div>

                            <div className="pt-2 text-center">
                                <span className="text-[10px] text-slate-600 font-mono uppercase tracking-tighter">Version {appVersion || '...'} • Made with ❤️ for Simmers</span>
                            </div>
                        </div>

                        {/* Update Management */}
                        <div className="space-y-3">
                            <button
                                onClick={async () => {
                                    setUpdateStatus('Checking...');
                                    const res = await (window as any).electron.invoke('check-for-updates');
                                    if (!res.success) setUpdateStatus(res.message);
                                }}
                                className="w-full bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 rounded-xl py-3 px-4 text-xs font-bold text-brand-secondary transition-all flex items-center justify-center gap-2 uppercase tracking-widest hover-glow"
                            >
                                <Check size={14} />
                                Check for Updates
                            </button>

                            {updateStatus && (
                                <div className="space-y-2">
                                    <p className="text-[10px] text-center font-mono text-slate-400 uppercase">
                                        {updateStatus === 'ready' ? 'Update Ready to Install' : updateStatus}
                                    </p>

                                    {updateStatus === 'ready' && (
                                        <button
                                            onClick={handleInstallUpdate}
                                            className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-4 px-4 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-600/20 active:scale-[0.98] flex items-center justify-center gap-2 hover-glow"
                                        >
                                            <DownloadCloud size={16} />
                                            Install & Restart
                                        </button>
                                    )}

                                    {updateProgress > 0 && updateProgress < 100 && updateStatus !== 'ready' && (
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full bg-brand-primary transition-all duration-300"
                                                style={{ width: `${updateProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
