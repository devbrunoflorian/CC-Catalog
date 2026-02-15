import React, { useState, useEffect } from 'react';
import { Clock, Calendar, FileArchive, CheckCircle2, AlertTriangle, Hash, FolderPlus, Folder, ChevronRight, ChevronDown, FolderOpen, Trash2, X, Upload } from 'lucide-react';

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
    onReport?: (log: ScanLog) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onReport }) => {
    const [buildingsData, setBuildingsData] = useState<{ history: ScanLog[], folders: ScanFolder[] }>({ history: [], folders: [] });
    const [uploadsData, setUploadsData] = useState<{ history: ScanLog[], folders: ScanFolder[] }>({ history: [], folders: [] });
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showNewFolderInput, setShowNewFolderInput] = useState<{ show: boolean, category: 'buildings' | 'uploads' }>({ show: false, category: 'buildings' });
    const [newFolderName, setNewFolderName] = useState('');

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

    const renderHistoryItem = (log: ScanLog) => (
        <div
            key={log.id}
            draggable
            onDragStart={(e) => handleDragStart(e, log.id)}
            className="relative group overflow-hidden bg-white/[0.03] backdrop-blur-md border border-border-subtle hover:border-brand-primary/30 rounded-xl p-3 flex justify-between items-center transition-all duration-300 hover:bg-white/[0.06] cursor-grab active:cursor-grabbing mb-2 last:mb-0 hover-lift"
        >
            <div className="flex items-center gap-3 relative z-10 overflow-hidden">
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

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {log.scannedFiles && log.scannedFiles.length > 2 && (
                    <button
                        onClick={() => onReport && onReport(log)}
                        className="p-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg transition-all hover-glow"
                        title="Generate Report"
                    >
                        <Hash size={14} />
                    </button>
                )}
                <button
                    onClick={(e) => handleDelete(log.id, e)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all hover-glow"
                    title="Delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );

    const renderFolder = (folder: ScanFolder, currentHistory: ScanLog[]) => {
        const isExpanded = expandedFolders.has(folder.id);
        const folderItems = currentHistory.filter(h => h.folderId === folder.id);

        return (
            <div
                key={folder.id}
                className="mb-3 rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] transition-all"
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
                                        scannedFiles: JSON.stringify(items),
                                        category: folder.category
                                    });
                                }
                            }}
                            className="p-1 text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Generate Folder Report"
                        >
                            <Hash size={14} />
                        </button>
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
                                Drop here
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

        return (
            <div
                className={`flex-grow flex flex-col min-w-0 glass-effect rounded-[2rem] border border-white/5 overflow-hidden transition-all ${category === 'buildings' ? 'bg-brand-primary/5' : 'bg-white/[0.02]'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null, category)}
            >
                <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-transparent backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${category === 'buildings' ? 'bg-brand-primary text-white' : 'bg-white/10 text-slate-300'}`}>
                            <Icon size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-slate-100">{title}</h3>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{data.history.length} Scans</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowNewFolderInput({ show: true, category })}
                        className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-brand-primary rounded-xl transition-all border border-white/5 hover-glow"
                        title="New Folder"
                    >
                        <FolderPlus size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-grow space-y-4">
                    {/* New Folder Input within column context */}
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

                    {/* Folders */}
                    {data.folders.map(f => renderFolder(f, data.history))}

                    {/* Root Items */}
                    {rootItems.length === 0 && data.folders.length === 0 ? (
                        <div className="text-center py-20 text-slate-700 italic text-xs">
                            Empty
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
                {renderColumn('Buildings', FileArchive, 'buildings', buildingsData)}
                {renderColumn('Uploads', Upload, 'uploads', uploadsData)}
            </div>
        </div>
    );
};

export default HistoryView;
