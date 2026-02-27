import React, { useState, useEffect } from 'react';
import { Clock, FileArchive, CheckCircle2, AlertTriangle, Hash, FolderPlus, Folder, ChevronRight, ChevronDown, FolderOpen, Trash2, Upload, Package, CheckSquare, Square, GripVertical } from 'lucide-react';

interface ScanLog {
    id: string;
    scanDate: string;
    fileName: string;
    itemsFound: number;
    creatorsFound: number;
    status: string;
    scannedFiles?: string;
    folderId?: string | null;
    category: 'buildings' | 'uploads';
}

interface ScanFolder {
    id: string;
    name: string;
    category: 'buildings' | 'uploads';
    createdAt: string;
}

interface HistoryViewProps {
    onReport?: (logs: ScanLog[]) => void;
    onBuildingSaved?: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onReport, onBuildingSaved }) => {
    const [buildingsData, setBuildingsData] = useState<{ history: ScanLog[], folders: ScanFolder[] }>({ history: [], folders: [] });
    const [uploadsData, setUploadsData] = useState<{ history: ScanLog[], folders: ScanFolder[] }>({ history: [], folders: [] });
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showNewFolderInput, setShowNewFolderInput] = useState<{ show: boolean, category: 'buildings' | 'uploads' }>({ show: false, category: 'buildings' });
    const [newFolderName, setNewFolderName] = useState('');
    const [scanningBuilding, setScanningBuilding] = useState(false);
    const [buildingScanResult, setBuildingScanResult] = useState<{ fileNames: string[], fileName: string, filePath: string } | null>(null);

    // Multi-select state — only for buildings
    const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
    // Track if user is dragging (to prevent click-select when drag starts)
    const draggingRef = React.useRef(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [bh, bf, uh, uf] = await Promise.all([
            (window as any).electron.invoke('get-history-by-category', 'buildings'),
            (window as any).electron.invoke('get-history-folders-by-category', 'buildings'),
            (window as any).electron.invoke('get-history-by-category', 'uploads'),
            (window as any).electron.invoke('get-history-folders-by-category', 'uploads')
        ]);
        setBuildingsData({ history: bh, folders: bf });
        setUploadsData({ history: uh, folders: uf });
    };

    const toggleBuildingSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedBuildingIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleGenerateSelectedReport = () => {
        if (!onReport || selectedBuildingIds.size === 0) return;
        const selectedLogs = buildingsData.history.filter(l => selectedBuildingIds.has(l.id));
        onReport(selectedLogs);
    };

    const handleScanBuilding = async () => {
        setScanningBuilding(true);
        try {
            const result = await (window as any).electron.invoke('scan-building');
            if (result) {
                setBuildingScanResult(result);
            }
        } catch (err) {
            console.error('Building scan failed:', err);
        } finally {
            setScanningBuilding(false);
        }
    };

    const handleConfirmBuildingScan = async () => {
        if (!buildingScanResult) return;
        try {
            await (window as any).electron.invoke('confirm-building-scan', {
                filePath: buildingScanResult.filePath,
                fileNames: buildingScanResult.fileNames
            });
            setBuildingScanResult(null);
            loadData();
            onBuildingSaved?.(); // Notify App.tsx to refresh buildingsHistory
        } catch (err) {
            console.error('Failed to confirm building scan:', err);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        await (window as any).electron.invoke('create-history-folder', {
            name: newFolderName,
            category: showNewFolderInput.category
        });
        setNewFolderName('');
        setShowNewFolderInput({ ...showNewFolderInput, show: false });
        loadData();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this scan history?')) {
            await (window as any).electron.invoke('delete-history-item', id);
            setSelectedBuildingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
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

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null, category: 'buildings' | 'uploads') => {
        e.preventDefault();
        const historyId = e.dataTransfer.getData('historyId');
        if (!historyId) return;

        await (window as any).electron.invoke('move-history-item', {
            historyId,
            folderId: targetFolderId,
            category: category
        });
        loadData();
    };

    const renderHistoryItem = (log: ScanLog) => {
        const isBuilding = log.category === 'buildings';
        const isSelected = isBuilding && selectedBuildingIds.has(log.id);

        return (
            <div
                key={log.id}
                onClick={isBuilding ? (e) => toggleBuildingSelection(log.id, e) : undefined}
                className={`relative group overflow-hidden rounded-xl p-3 flex justify-between items-center transition-all duration-200 mb-2 last:mb-0 border
                    ${isBuilding
                        ? isSelected
                            ? 'bg-brand-primary/15 border-brand-primary/50 cursor-pointer shadow-[0_0_12px_rgba(var(--brand-primary),0.15)]'
                            : 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08] hover:border-brand-primary/20 cursor-pointer'
                        : 'glass-card border-white/5 hover:bg-white/[0.08] hover-lift'
                    }`}
            >
                {/* Drag Handle */}
                <div
                    draggable
                    onDragStart={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, log.id);
                    }}
                    className="shrink-0 mr-2 p-1 rounded-md text-slate-700 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing hover:bg-white/5"
                    title="Drag to move"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={14} />
                </div>
                {/* Selection indicator for buildings */}
                {isBuilding && (
                    <div className={`shrink-0 mr-3 transition-colors ${isSelected ? 'text-brand-primary' : 'text-slate-600 group-hover:text-slate-400'}`}>
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                )}

                <div className="flex items-center gap-3 relative z-10 overflow-hidden flex-grow">
                    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${log.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {log.status === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-100 group-hover:text-white transition-colors truncate">
                            <FileArchive size={12} className="text-brand-secondary opacity-80 shrink-0" />
                            <span className="truncate">{log.fileName}</span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 flex items-center gap-2 mt-0.5 opacity-70">
                            {new Date(log.scanDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            <span>•</span>
                            {log.itemsFound} items
                        </div>
                    </div>
                </div>

                {/* Delete button */}
                <button
                    onClick={(e) => handleDelete(log.id, e)}
                    className="p-1.5 bg-transparent hover:bg-red-500/10 text-slate-700 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                    title="Delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        );
    };

    const renderFolder = (folder: ScanFolder, currentHistory: ScanLog[]) => {
        const isExpanded = expandedFolders.has(folder.id);
        const folderItems = currentHistory.filter(h => h.folderId === folder.id);

        return (
            <div
                key={folder.id}
                className="mb-3 rounded-2xl overflow-hidden border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, folder.id, folder.category);
                }}
            >
                <div
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5 transition-colors group hover-glow"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-brand-secondary group-hover:text-brand-primary transition-colors">
                            {isExpanded ? <FolderOpen size={18} /> : <Folder size={18} />}
                        </div>
                        <span className="font-bold text-slate-200 text-sm group-hover:text-white transition-colors truncate max-w-[150px]">{folder.name}</span>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{folderItems.length}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={(e) => handleDeleteFolder(folder.id, e)}
                            className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Folder"
                        >
                            <Trash2 size={14} />
                        </button>
                        <div className="text-slate-600">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3 pt-0 pl-6 space-y-2 animate-in fade-in slide-in-from-top-2">
                        {folderItems.length === 0 ? (
                            <div className="text-center py-3 text-[10px] text-slate-600 italic border-l border-white/5 pl-4">
                                Empty
                            </div>
                        ) : (
                            folderItems.map(renderHistoryItem)
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderColumn = (title: string, Icon: any, category: 'buildings' | 'uploads', data: { history: ScanLog[], folders: ScanFolder[] }) => {
        const rootItems = data.history.filter(h => !h.folderId);
        const isBuildings = category === 'buildings';

        return (
            <div
                className={`flex-grow flex flex-col min-w-0 glass-mica rounded-[2rem] border border-white/5 overflow-hidden transition-all relative ${isBuildings ? 'bg-brand-primary/[0.02]' : 'bg-white/[0.01]'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null, category)}
            >
                {/* Column Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-transparent backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isBuildings ? 'bg-brand-primary text-white' : 'bg-white/10 text-slate-300'}`}>
                            <Icon size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-slate-100">{title}</h3>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{data.history.length} Scans</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isBuildings && (
                            <button
                                onClick={handleScanBuilding}
                                disabled={scanningBuilding}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${scanningBuilding
                                    ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
                                    : 'bg-brand-primary/10 border-brand-primary/30 text-brand-secondary hover:bg-brand-primary hover:text-white hover-glow'
                                    }`}
                                title="Scan Building ZIP"
                            >
                                <Package size={14} />
                                {scanningBuilding ? 'Scanning...' : 'Scan Building'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowNewFolderInput({ show: true, category })}
                            className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-brand-primary rounded-xl transition-all border border-white/5 hover-glow"
                            title="New Folder"
                        >
                            <FolderPlus size={18} />
                        </button>
                    </div>
                </div>

                {/* Selected buildings bar */}
                {isBuildings && selectedBuildingIds.size > 0 && (
                    <div className="mx-4 mt-4 p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-brand-secondary">
                                {selectedBuildingIds.size} building{selectedBuildingIds.size > 1 ? 's' : ''} selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedBuildingIds(new Set())}
                                className="text-[10px] text-slate-500 hover:text-slate-300 font-bold px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleGenerateSelectedReport}
                                className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all active:scale-[0.98] hover-glow"
                            >
                                <Hash size={12} />
                                Generate Report
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-6 overflow-y-auto custom-scrollbar flex-grow space-y-4">
                    {/* New Folder Input */}
                    {showNewFolderInput.show && showNewFolderInput.category === category && (
                        <div className="mb-4 p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-2xl animate-in scale-in-95 duration-200">
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Name..."
                                className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 w-full text-xs font-bold mb-3"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateFolder}
                                    className="flex-grow py-2 bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-secondary transition-colors hover-glow"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => setShowNewFolderInput({ ...showNewFolderInput, show: false })}
                                    className="px-4 py-2 bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Helper hint for buildings */}
                    {isBuildings && data.history.length > 0 && selectedBuildingIds.size === 0 && (
                        <div className="text-[10px] text-slate-600 italic text-center py-1">
                            Click buildings to select, then Generate Report
                        </div>
                    )}

                    {/* Folders */}
                    {data.folders.map(f => renderFolder(f, data.history))}

                    {/* Items */}
                    {rootItems.length === 0 && data.folders.length === 0 ? (
                        <div className="text-center py-20 text-slate-700 italic text-xs">
                            {isBuildings ? 'Scan a building ZIP to get started' : 'Empty'}
                        </div>
                    ) : (
                        <>
                            {rootItems.length > 0 && data.folders.length > 0 && (
                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-6 mb-3 pl-2 opacity-50">Root Items</div>
                            )}
                            {rootItems.map(renderHistoryItem)}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between shrink-0">
                <h2 className="text-3xl font-black flex items-center gap-3 bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                    <Clock className="text-brand-primary/80" />
                    Scan History
                </h2>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                    Drag & Drop to Organize
                </div>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20 overflow-hidden">
                {renderColumn('Buildings', Package, 'buildings', buildingsData)}
                {renderColumn('Uploads', Upload, 'uploads', uploadsData)}
            </div>

            {/* Building Scan Confirmation Modal */}
            {buildingScanResult && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={(e) => { if (e.target === e.currentTarget) setBuildingScanResult(null); }}
                >
                    <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-8 py-6 border-b border-border-subtle bg-gradient-to-r from-brand-primary/10 to-transparent">
                            <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                                <Package className="text-brand-primary" />
                                Building Scanned
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Found <span className="text-brand-secondary font-bold">{buildingScanResult.fileNames.length}</span> items in <span className="text-slate-300 font-semibold">{buildingScanResult.fileName}</span>
                            </p>
                        </div>
                        <div className="p-8">
                            {buildingScanResult.fileNames.length === 0 ? (
                                <div className="text-center py-4 text-slate-500 italic text-sm">
                                    No .package files found in this archive.
                                </div>
                            ) : (
                                <div className="bg-black/20 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar mb-6 space-y-1">
                                    {buildingScanResult.fileNames.map((f, i) => (
                                        <div key={i} className="text-xs text-slate-400 font-mono truncate hover:text-slate-200 transition-colors">
                                            {f}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleConfirmBuildingScan}
                                    disabled={buildingScanResult.fileNames.length === 0}
                                    className="flex-grow py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save to Buildings
                                </button>
                                <button
                                    onClick={() => setBuildingScanResult(null)}
                                    className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-slate-400 transition-all border border-white/5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryView;
