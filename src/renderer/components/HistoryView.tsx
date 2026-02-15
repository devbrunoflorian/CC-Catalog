import React, { useState, useEffect } from 'react';
import { Clock, Calendar, FileArchive, CheckCircle2, AlertTriangle, Hash, FolderPlus, Folder, ChevronRight, ChevronDown, FolderOpen, Trash2, X } from 'lucide-react';

interface ScanLog {
    id: string;
    scanDate: string;
    fileName: string;
    itemsFound: number;
    creatorsFound: number;
    status: string;
    scannedFiles?: string;
    folderId?: string | null;
}

interface ScanFolder {
    id: string;
    name: string;
    createdAt: string;
}

interface HistoryViewProps {
    onReport?: (log: ScanLog) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onReport }) => {
    const [history, setHistory] = useState<ScanLog[]>([]);
    const [folders, setFolders] = useState<ScanFolder[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const historyData = await (window as any).electron.invoke('get-history');
        const foldersData = await (window as any).electron.invoke('get-history-folders');
        setHistory(historyData);
        setFolders(foldersData);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        await (window as any).electron.invoke('create-history-folder', newFolderName);
        setNewFolderName('');
        setShowNewFolderInput(false);
        loadData();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this scan history?')) {
            await (window as any).electron.invoke('delete-history-item', id);
            loadData();
        }
    };

    const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this folder? Items inside will be moved to the root.')) {
            await (window as any).electron.invoke('delete-history-folder', id);
            loadData();
        }
    };

    const toggleFolder = (folderId: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        setExpandedFolders(newExpanded);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('historyId', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        const historyId = e.dataTransfer.getData('historyId');
        if (!historyId) return;

        await (window as any).electron.invoke('move-history-item', {
            historyId,
            folderId: targetFolderId
        });
        loadData();
    };

    const renderHistoryItem = (log: ScanLog) => (
        <div
            key={log.id}
            draggable
            onDragStart={(e) => handleDragStart(e, log.id)}
            className="relative group overflow-hidden bg-white/[0.03] backdrop-blur-md border border-border-subtle hover:border-brand-primary/30 rounded-2xl p-4 flex justify-between items-center transition-all duration-300 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-brand-primary/5 hover:-translate-y-1 cursor-grab active:cursor-grabbing mb-3 last:mb-0"
        >
            {/* Glass shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10 overflow-hidden">
                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-inner ${log.status === 'success' ? 'bg-green-500/10 text-green-400 shadow-green-500/10' : 'bg-red-500/10 text-red-400 shadow-red-500/10'}`}>
                    {log.status === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold text-base text-slate-100 group-hover:text-white transition-colors truncate">
                        <FileArchive size={16} className="text-brand-secondary opacity-80 shrink-0" />
                        <span className="truncate">{log.fileName}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 flex items-center gap-2 mt-1 uppercase tracking-wide truncate">
                        <Calendar size={10} />
                        {new Date(log.scanDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        <span className="opacity-50">•</span>
                        {new Date(log.scanDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 relative z-10 shrink-0">
                <div className="flex gap-4 text-right mr-2 border-r border-white/10 pr-4 hidden sm:flex">
                    <div className="group/stat">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-0.5 opacity-70 group-hover/stat:opacity-100 transition-opacity">Items</div>
                        <div className="text-lg font-mono text-slate-200 group-hover/stat:text-brand-secondary transition-colors leading-none">{log.itemsFound}</div>
                    </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                    {/* Only show report button if scannedFiles data is available and meaningful */}
                    {log.scannedFiles && log.scannedFiles.length > 2 && (
                        <button
                            onClick={() => onReport && onReport(log)}
                            className="p-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg transition-all hover:shadow-lg hover:shadow-brand-primary/20 active:scale-95"
                            title="Generate Report"
                        >
                            <Hash size={16} />
                        </button>
                    )}

                    <button
                        onClick={(e) => handleDelete(log.id, e)}
                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
                        title="Delete History"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderFolder = (folder: ScanFolder) => {
        const isExpanded = expandedFolders.has(folder.id);
        const folderItems = history.filter(h => h.folderId === folder.id);

        return (
            <div
                key={folder.id}
                className="mb-4 rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] transition-all"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                    e.stopPropagation(); // Prevent dropping on root
                    handleDrop(e, folder.id);
                }}
            >
                <div
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-brand-secondary group-hover:text-brand-primary transition-colors">
                            {isExpanded ? <FolderOpen size={20} /> : <Folder size={20} />}
                        </div>
                        <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{folder.name}</span>
                        <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{folderItems.length}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                const items = await (window as any).electron.invoke('get-folder-scanned-files', folder.id);
                                if (onReport) {
                                    onReport({
                                        id: `folder-${folder.id}`,
                                        fileName: `Folder: ${folder.name}`,
                                        scanDate: new Date().toISOString(),
                                        itemsFound: folderItems.reduce((acc, h) => acc + h.itemsFound, 0),
                                        creatorsFound: 0,
                                        status: 'success',
                                        scannedFiles: JSON.stringify(items)
                                    });
                                }
                            }}
                            className="p-1.5 text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Generate Folder Report"
                        >
                            <Hash size={14} />
                        </button>
                        <button
                            onClick={(e) => handleDeleteFolder(folder.id, e)}
                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Folder"
                        >
                            <Trash2 size={14} />
                        </button>
                        <div className="text-slate-600">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-4 pt-0 pl-8 space-y-3 animate-in fade-in slide-in-from-top-2">
                        {folderItems.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-600 italic border-l-2 border-white/5 pl-4">
                                Drop scan logs here to organize
                            </div>
                        ) : (
                            folderItems.map(renderHistoryItem)
                        )}
                    </div>
                )}
            </div>
        );
    };

    const rootItems = history.filter(h => !h.folderId);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                    <Clock className="text-brand-primary/80" />
                    Scan History
                </h2>

                <button
                    onClick={() => setShowNewFolderInput(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 active:scale-95"
                >
                    <FolderPlus size={16} />
                    New Folder
                </button>
            </div>

            {/* New Folder Input */}
            {showNewFolderInput && (
                <div className="mb-6 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
                    <FolderPlus size={20} className="text-brand-primary" />
                    <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder Name (e.g., 'Weekly Scans')"
                        className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 flex-grow text-sm font-medium"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreateFolder}
                            className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-secondary transition-colors"
                        >
                            Create
                        </button>
                        <button
                            onClick={() => setShowNewFolderInput(false)}
                            className="px-3 py-1.5 bg-white/5 text-slate-400 text-xs font-bold rounded-lg hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div
                className="space-y-4 min-h-[500px]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)} // Drop on root
            >
                {/* Folders */}
                {folders.map(renderFolder)}

                {/* Root Items */}
                {rootItems.length === 0 && folders.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed backdrop-blur-sm">
                        No scan history available.
                    </div>
                ) : (
                    <>
                        {rootItems.length > 0 && folders.length > 0 && (
                            <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-8 mb-4 pl-2">Unorganized Scans</div>
                        )}
                        {rootItems.map(renderHistoryItem)}
                    </>
                )}
            </div>
        </div>
    );
};

export default HistoryView;
