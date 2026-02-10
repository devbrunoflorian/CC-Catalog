import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Link2, Globe, FolderPlus, Trash2, Edit2, File as FileIcon, ChevronRight, ChevronDown, Check, X, GripVertical, Save } from 'lucide-react';

interface Item {
    id: string;
    fileName: string;
    displayName?: string;
}

interface CreatorSet {
    id: string;
    name: string;
    patreonUrl?: string;
    websiteUrl?: string;
    items: Item[];
}

interface CreatorDetails {
    id: string;
    name: string;
    patreon_url: string;
    website_url: string;
    sets: CreatorSet[];
}

interface CreatorSummary {
    id: string;
    name: string;
    sets: { itemsCount: number }[];
}

const CreatorsView: React.FC = () => {
    const [creatorsList, setCreatorsList] = useState<CreatorSummary[]>([]);
    const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
    const [creatorDetails, setCreatorDetails] = useState<CreatorDetails | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // UI State
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [expandedSets, setExpandedSets] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('cc-expanded-sets');
        try {
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    useEffect(() => {
        localStorage.setItem('cc-expanded-sets', JSON.stringify(Array.from(expandedSets)));
    }, [expandedSets]);

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [editingSetId, setEditingSetId] = useState<string | null>(null);

    // Creator Editing
    const [editingCreator, setEditingCreator] = useState(false);
    const [creatorForm, setCreatorForm] = useState({ patreon_url: '', website_url: '' });

    // Forms
    const [editSetForm, setEditSetForm] = useState({ name: '', patreon_url: '', website_url: '' });
    const [newSetName, setNewSetName] = useState('');
    const [showNewSetInput, setShowNewSetInput] = useState(false);

    useEffect(() => {
        loadCreatorsList();
    }, []);

    useEffect(() => {
        if (selectedCreatorId) {
            loadCreatorDetails(selectedCreatorId);
        }
    }, [selectedCreatorId]);

    const loadCreatorsList = async () => {
        const data = await (window as any).electron.invoke('get-creators-list');
        setCreatorsList(data);
    };

    const loadCreatorDetails = async (id: string) => {
        setLoadingDetails(true);
        try {
            const data = await (window as any).electron.invoke('get-creator-details', id);
            setCreatorDetails(data);
            setCreatorForm({
                patreon_url: data.patreon_url || '',
                website_url: data.website_url || ''
            });
        } finally {
            setLoadingDetails(false);
        }
    };

    const toggleSetExpansion = (setId: string) => {
        const newExpanded = new Set(expandedSets);
        if (newExpanded.has(setId)) {
            newExpanded.delete(setId);
        } else {
            newExpanded.add(setId);
        }
        setExpandedSets(newExpanded);
    };

    const toggleItemSelection = (itemId: string, multiSelect: boolean) => {
        const newSelected = new Set(multiSelect ? selectedItems : []);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedItems(newSelected);
    };

    const handleCreateSet = async () => {
        if (!newSetName.trim() || !selectedCreatorId) return;
        await (window as any).electron.invoke('create-set', {
            creatorId: selectedCreatorId,
            name: newSetName
        });
        setNewSetName('');
        setShowNewSetInput(false);
        loadCreatorDetails(selectedCreatorId);
    };

    const handleUpdateSet = async (setId: string) => {
        await (window as any).electron.invoke('update-set-link', {
            id: setId,
            name: editSetForm.name,
            patreon_url: editSetForm.patreon_url,
            website_url: editSetForm.website_url
        });
        setEditingSetId(null);
        loadCreatorDetails(selectedCreatorId!);
    };

    const handleUpdateCreator = async () => {
        if (!selectedCreatorId) return;
        await (window as any).electron.invoke('update-creator', {
            id: selectedCreatorId,
            ...creatorForm
        });
        setEditingCreator(false);
        loadCreatorDetails(selectedCreatorId);
    };

    const handleDeleteSet = async (setId: string) => {
        if (!confirm('Are you sure you want to delete this empty set?')) return;
        try {
            await (window as any).electron.invoke('delete-set', setId);
            loadCreatorDetails(selectedCreatorId!);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleMoveItems = async (targetSetId: string, itemIds: string[]) => {
        await (window as any).electron.invoke('move-items', {
            itemIds: itemIds,
            targetSetId: targetSetId
        });

        setSelectedItems(new Set());
        loadCreatorDetails(selectedCreatorId!);
    };

    const startEditingSet = (set: CreatorSet) => {
        setEditingSetId(set.id);
        setEditSetForm({
            name: set.name,
            patreon_url: set.patreonUrl || '',
            website_url: set.websiteUrl || ''
        });
    };

    // Drag and Drop Logic for Items
    const draggingType = React.useRef<'item' | 'set' | null>(null);
    const [draggingSetId, setDraggingSetId] = useState<string | null>(null);
    const [dropTargetSetId, setDropTargetSetId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'merge' | null>(null);

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        draggingType.current = 'item';
        e.dataTransfer.setData('text/plain', itemId);
        e.dataTransfer.effectAllowed = 'move';

        if (!selectedItems.has(itemId)) {
            setSelectedItems(new Set([itemId]));
        }
        e.stopPropagation();
    };

    const handleSetDragStart = (e: React.DragEvent, setId: string) => {
        draggingType.current = 'set';
        setDraggingSetId(setId);
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'set', id: setId }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleSetDragOver = (e: React.DragEvent, targetSetId: string) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to parent container

        if (draggingType.current !== 'set' || draggingSetId === targetSetId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        // Visual zones logic
        // Center 60% -> Merge (20% to 80%)
        // Top 20% -> Reorder Before
        // Bottom 20% -> Reorder After

        if (y < height * 0.25) {
            setDropPosition('before');
        } else if (y > height * 0.75) {
            setDropPosition('after');
        } else {
            setDropPosition('merge');
        }
        setDropTargetSetId(targetSetId);
    };

    const handleSetDragLeave = () => {
        setDropTargetSetId(null);
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent, targetSetId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (draggingType.current === 'item') {
            const draggedItemId = e.dataTransfer.getData('text/plain');
            const itemsToMove = selectedItems.has(draggedItemId)
                ? Array.from(selectedItems)
                : [draggedItemId];

            handleMoveItems(targetSetId, itemsToMove);
        } else if (draggingType.current === 'set') {
            const sourceSetId = draggingSetId;
            if (!sourceSetId || sourceSetId === targetSetId) return;

            if (dropPosition === 'merge') {
                if (confirm('Are you sure you want to merge these sets? The dragged set will be deleted and its items moved to the target set.')) {
                    (window as any).electron.invoke('merge-sets', { sourceSetId, targetSetId }).then(() => {
                        loadCreatorDetails(selectedCreatorId!);
                    });
                }
            } else if (dropPosition === 'before' || dropPosition === 'after') {
                // Reorder Logic
                if (!creatorDetails) return;

                const sets = [...creatorDetails.sets];
                const sourceIndex = sets.findIndex(s => s.id === sourceSetId);
                const targetIndex = sets.findIndex(s => s.id === targetSetId);

                if (sourceIndex === -1 || targetIndex === -1) return;

                // Remove source
                const [movedSet] = sets.splice(sourceIndex, 1);

                // Calculate insert index
                // Note: if we removed an item before the target, the target index shifted down by 1
                let insertIndex = targetIndex;
                if (sourceIndex < targetIndex) insertIndex--; // Adjust because source was removed from before

                if (dropPosition === 'after') insertIndex++;

                sets.splice(insertIndex, 0, movedSet);

                // Create update payload with new sort orders
                const updates = sets.map((s, index) => ({
                    id: s.id,
                    sortOrder: index
                }));

                // Update locally immediately for responsiveness (optimistic UI could be improved but this is fast enough usually)
                // Actually let's just wait for reload to avoid complex state sync
                (window as any).electron.invoke('reorder-sets', { setsOrder: updates }).then(() => {
                    loadCreatorDetails(selectedCreatorId!);
                });
            }

            setDraggingSetId(null);
            setDropTargetSetId(null);
            setDropPosition(null);
        }
        draggingType.current = null;
    };

    // Derived state
    const filteredCreators = creatorsList.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-full gap-6 overflow-hidden">
            {/* List Column */}
            <div className="w-1/3 flex flex-col gap-4 min-w-[250px] shrink-0 bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-xl">
                <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2 shrink-0 focus-within:border-brand-primary/50 transition-colors">
                    <Search size={18} className="text-slate-500" />
                    <input
                        type="text"
                        placeholder="Filter creators..."
                        className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredCreators.map(creator => (
                        <div
                            key={creator.id}
                            onClick={() => setSelectedCreatorId(creator.id)}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border group relative overflow-hidden ${selectedCreatorId === creator.id
                                ? 'bg-brand-primary/10 border-brand-primary/50 shadow-[0_0_20px_hsl(var(--brand-primary)/0.2)]'
                                : 'bg-transparent border-transparent hover:bg-white/5 hover:border-brand-primary/30 hover:shadow-[0_0_15px_hsl(var(--brand-primary)/0.15)]'
                                }`}
                        >
                            <div className={`font-bold transition-colors ${selectedCreatorId === creator.id ? 'text-brand-secondary' : 'text-slate-300 group-hover:text-slate-100'}`}>
                                {creator.name}
                            </div>
                            <div className="text-xs text-slate-600 mt-1 flex justify-between group-hover:text-slate-500">
                                <span>{creator.sets.length} Sets</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail Column */}
            <div className="flex-grow bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
                {selectedCreatorId && creatorDetails ? (
                    <>
                        {/* Creator Header */}
                        <div className="p-8 border-b border-white/5 shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
                            <div className="flex justify-between items-start">
                                <div className="space-y-4 flex-grow">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">{creatorDetails.name}</h2>
                                        <button
                                            onClick={() => setEditingCreator(!editingCreator)}
                                            className={`p-2 rounded-lg transition-all duration-300 ${editingCreator ? 'bg-brand-primary/20 text-brand-secondary' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                                        >
                                            {editingCreator ? <X size={18} /> : <Edit2 size={18} />}
                                        </button>
                                    </div>

                                    {editingCreator ? (
                                        <div className="grid grid-cols-2 gap-4 max-w-2xl animate-in slide-in-from-top-2 bg-black/20 p-4 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/5 focus-within:border-brand-primary/50 transition-colors">
                                                <ExternalLink size={14} className="text-slate-500 shrink-0" />
                                                <input
                                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-600"
                                                    placeholder="Patreon URL"
                                                    value={creatorForm.patreon_url}
                                                    onChange={e => setCreatorForm({ ...creatorForm, patreon_url: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/5 focus-within:border-brand-primary/50 transition-colors">
                                                <Globe size={14} className="text-slate-500 shrink-0" />
                                                <input
                                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-600"
                                                    placeholder="Website URL"
                                                    value={creatorForm.website_url}
                                                    onChange={e => setCreatorForm({ ...creatorForm, website_url: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <button
                                                    onClick={handleUpdateCreator}
                                                    className="bg-brand-primary text-white text-xs font-bold px-6 py-2.5 rounded-lg hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 flex items-center gap-2"
                                                >
                                                    <Save size={14} /> Save Links
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-6 text-sm text-slate-400">
                                            {creatorDetails.patreon_url ? (
                                                <a href={creatorDetails.patreon_url} target="_blank" className="flex items-center gap-2 hover:text-brand-primary transition-colors hover:underline decoration-brand-primary/30 underline-offset-4">
                                                    <ExternalLink size={14} /> Patreon Page
                                                </a>
                                            ) : <span className="text-slate-600 flex items-center gap-2"><ExternalLink size={14} /> No Patreon link</span>}

                                            {creatorDetails.website_url ? (
                                                <a href={creatorDetails.website_url} target="_blank" className="flex items-center gap-2 hover:text-brand-primary transition-colors hover:underline decoration-brand-primary/30 underline-offset-4">
                                                    <Globe size={14} /> Website
                                                </a>
                                            ) : <span className="text-slate-600 flex items-center gap-2"><Globe size={14} /> No Website link</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowNewSetInput(true)}
                                        className="flex items-center gap-2 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 hover:border-brand-primary/40 px-5 py-2.5 rounded-xl text-sm font-bold text-brand-secondary transition-all shadow-lg shadow-brand-primary/5"
                                    >
                                        <FolderPlus size={18} /> New Set
                                    </button>
                                </div>
                            </div>

                            {/* New Set Input */}
                            {showNewSetInput && (
                                <div className="mt-6 flex gap-2 animate-in slide-in-from-top-2 bg-black/40 p-2 rounded-xl border border-white/10 backdrop-blur-md absolute top-20 right-8 z-20 shadow-2xl">
                                    <input
                                        autoFocus
                                        className="bg-transparent border-none rounded-lg px-3 py-2 text-sm w-64 text-slate-200 outline-none placeholder-slate-500"
                                        placeholder="Set Name (e.g. Kitchen, Berlin)"
                                        value={newSetName}
                                        onChange={e => setNewSetName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                                    />
                                    <button onClick={handleCreateSet} className="bg-brand-primary px-3 rounded-lg text-white hover:bg-brand-secondary transition-colors">
                                        <Check size={18} />
                                    </button>
                                    <button onClick={() => setShowNewSetInput(false)} className="bg-white/5 px-3 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors">
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sets List */}
                        <div className="flex-grow overflow-y-auto custom-scrollbar p-8 space-y-4">
                            {creatorDetails.sets.map((set) => (
                                <div
                                    key={set.id}
                                    draggable
                                    onDragStart={(e) => handleSetDragStart(e, set.id)}
                                    className={`
                                        bg-white/[0.02] border rounded-xl overflow-hidden transition-all duration-300
                                        ${draggingSetId === set.id ? 'opacity-50 scale-95' : ''}
                                        ${dropTargetSetId === set.id && dropPosition === 'merge'
                                            ? 'border-brand-primary bg-brand-primary/20 shadow-[0_0_30px_hsl(var(--brand-primary)/0.2)] scale-[1.02]'
                                            : 'border-white/5 hover:bg-white/[0.04] hover:border-brand-primary/30'}
                                        ${dropTargetSetId === set.id && dropPosition === 'before' ? 'border-t-2 border-t-brand-primary pt-1' : ''}
                                        ${dropTargetSetId === set.id && dropPosition === 'after' ? 'border-b-2 border-b-brand-primary pb-1' : ''}
                                    `}
                                    onDragOver={(e) => handleSetDragOver(e, set.id)}
                                    onDragLeave={handleSetDragLeave}
                                    onDrop={(e) => handleDrop(e, set.id)}
                                >
                                    {/* Set Header */}
                                    <div className="p-4 flex items-center justify-between group">
                                        <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={(e) => {
                                            toggleSetExpansion(set.id);
                                        }}>
                                            <div className="cursor-grab active:cursor-grabbing p-1.5 text-slate-600 hover:text-slate-400" onMouseDown={e => e.stopPropagation()}>
                                                <GripVertical size={16} />
                                            </div>
                                            <div className={`p-1.5 rounded-lg transition-colors ${expandedSets.has(set.id) ? 'bg-white/10 text-white' : 'text-slate-500 group-hover:bg-white/5 group-hover:text-slate-300'}`}>
                                                {expandedSets.has(set.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </div>

                                            {editingSetId === set.id ? (
                                                <div className="flex-grow flex gap-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        className="bg-black/40 border border-brand-primary/50 rounded-lg px-3 py-1.5 text-sm text-white w-full outline-none caret-brand-primary shadow-inner"
                                                        value={editSetForm.name}
                                                        onChange={e => setEditSetForm({ ...editSetForm, name: e.target.value })}
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdateSet(set.id);
                                                            e.stopPropagation();
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex-grow">
                                                    <div className="font-semibold text-slate-200 flex items-center gap-3">
                                                        {set.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex gap-4 mt-1">
                                                        <span>{set.items.length} items</span>
                                                        {(set.patreonUrl || set.websiteUrl) && <span className="flex items-center gap-1 text-brand-secondary/80 bg-brand-primary/10 px-2 py-0.5 rounded-full border border-brand-primary/10"><Link2 size={10} /> Linked</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {editingSetId === set.id ? (
                                                <div className="flex gap-2 animate-in fade-in">
                                                    <button onClick={() => handleUpdateSet(set.id)} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 border border-green-500/20 transition-colors"><Check size={16} /></button>
                                                    <button onClick={() => setEditingSetId(null)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition-colors"><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    <button onClick={() => startEditingSet(set)} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-brand-primary transition-colors">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    {set.items.length === 0 && (
                                                        <button onClick={() => handleDeleteSet(set.id)} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Set Edit Panel (Links) */}
                                    {editingSetId === set.id && (
                                        <div className="px-4 pb-4 pl-14 space-y-3 bg-black/20 pt-2 animate-in slide-in-from-top-1">
                                            <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20 border border-white/5 focus-within:border-brand-primary/30 transition-colors">
                                                <Link2 size={14} className="text-slate-500" />
                                                <input
                                                    className="bg-transparent border-none outline-none text-xs w-full text-slate-300 placeholder-slate-600"
                                                    placeholder="Patreon Post URL"
                                                    value={editSetForm.patreon_url}
                                                    onChange={e => setEditSetForm({ ...editSetForm, patreon_url: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 p-2 rounded-lg bg-black/20 border border-white/5 focus-within:border-brand-primary/30 transition-colors">
                                                <Globe size={14} className="text-slate-500" />
                                                <input
                                                    className="bg-transparent border-none outline-none text-xs w-full text-slate-300 placeholder-slate-600"
                                                    placeholder="Website URL"
                                                    value={editSetForm.website_url}
                                                    onChange={e => setEditSetForm({ ...editSetForm, website_url: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Items List (Collapsible) */}
                                    {expandedSets.has(set.id) && (
                                        <div className="border-t border-white/5 bg-black/20 min-h-[40px] shadow-inner">
                                            {set.items.map(item => (
                                                <div
                                                    key={item.id}
                                                    className={`px-4 py-2.5 flex items-center gap-3 text-sm transition-all cursor-grab active:cursor-grabbing border-l-[3px] select-none group/item ${selectedItems.has(item.id)
                                                        ? 'border-brand-primary bg-brand-primary/10 text-white'
                                                        : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                                        }`}
                                                    onClick={(e) => toggleItemSelection(item.id, e.ctrlKey || e.shiftKey)}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, item.id)}
                                                >
                                                    <GripVertical size={14} className="text-slate-600 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                                                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${selectedItems.has(item.id) ? 'bg-brand-primary border-brand-primary' : 'border-slate-600 bg-transparent'}`}>
                                                        {selectedItems.has(item.id) && <Check size={10} className="text-white" />}
                                                    </div>
                                                    <FileIcon size={14} className={selectedItems.has(item.id) ? 'text-brand-secondary' : 'text-slate-600 group-hover/item:text-slate-400 transition-colors'} />
                                                    <span className="truncate font-mono text-xs opacity-90">{item.fileName}</span>
                                                </div>
                                            ))}
                                            {set.items.length === 0 && (
                                                <div className="px-10 py-6 text-xs text-slate-500 italic border-2 border-dashed border-white/5 m-4 rounded-xl text-center bg-white/[0.01]">
                                                    Drag items here to organize
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-slate-500 gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                            <Search size={30} className="text-slate-600" />
                        </div>
                        <p className="font-medium">{loadingDetails ? 'Loading details...' : 'Select a creator to manage library'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatorsView;
