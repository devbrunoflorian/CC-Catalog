import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Link2, Globe, FolderPlus, Trash2, Edit2, File as FileIcon, ChevronRight, ChevronDown, Check, X, GripVertical, Save, ArrowUp, SortAsc, SortDesc, ListFilter, Move } from 'lucide-react';

interface Item {
    id: string;
    fileName: string;
    displayName?: string;
}

interface CreatorSet {
    id: string;
    name: string;
    parent_id?: string | null;
    patreon_url?: string | null;
    website_url?: string | null;
    extra_links?: string | null;
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
    const [editSetForm, setEditSetForm] = useState<{ name: string; links: { type: string; url: string }[] }>({ name: '', links: [] });
    const [newSetName, setNewSetName] = useState('');
    const [showNewSetInput, setShowNewSetInput] = useState(false);
    const [activeParentSetId, setActiveParentSetId] = useState<string | null>(null);

    // Sorting State
    const [creatorSort, setCreatorSort] = useState<'az' | 'za' | 'items'>('az');
    const [setSort, setSetSort] = useState<'az' | 'za' | 'items'>('az');
    const [itemSort, setItemSort] = useState<'az' | 'za'>('az');

    // Move to Set Modal State
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveSearch, setMoveSearch] = useState('');

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

    const toggleSetSelection = (set: CreatorSet, currentSelected: Set<string>) => {
        const itemIds = set.items.map(i => i.id);
        const allSelected = itemIds.every(id => currentSelected.has(id));

        const newSelected = new Set(currentSelected);
        if (allSelected) {
            itemIds.forEach(id => newSelected.delete(id));
        } else {
            itemIds.forEach(id => newSelected.add(id));
        }
        setSelectedItems(newSelected);
    };

    const handleCreateSet = async () => {
        if (!newSetName.trim() || !selectedCreatorId) return;
        await (window as any).electron.invoke('create-set', {
            creatorId: selectedCreatorId,
            name: newSetName,
            parentId: activeParentSetId
        });
        setNewSetName('');
        setShowNewSetInput(false);
        setActiveParentSetId(null);
        loadCreatorDetails(selectedCreatorId);
    };

    const handleUpdateSet = async (setId: string) => {
        // Process links
        const validLinks = editSetForm.links.filter(l => l.url.trim());

        let patreonUrl = null;
        let websiteUrl = null;

        // Find first patreon
        const pIdx = validLinks.findIndex(l => l.type === 'patreon');
        if (pIdx >= 0) {
            patreonUrl = validLinks[pIdx].url;
            validLinks.splice(pIdx, 1);
        }

        // Find first website
        const wIdx = validLinks.findIndex(l => l.type === 'website');
        if (wIdx >= 0) {
            websiteUrl = validLinks[wIdx].url;
            validLinks.splice(wIdx, 1);
        }

        await (window as any).electron.invoke('update-set-link', {
            id: setId,
            name: editSetForm.name,
            patreon_url: patreonUrl,
            website_url: websiteUrl,
            extra_links: JSON.stringify(validLinks) // Remaining links
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
        const set = creatorDetails?.sets.find(s => s.id === setId);
        const itemCount = set?.items.length || 0;
        let deleteItems = false;

        const message = itemCount > 0
            ? `This set contains ${itemCount} items. Deleting it will REMOVE these items from the catalog. Are you sure?`
            : 'Are you sure you want to delete this empty set?';

        if (!confirm(message)) return;

        if (itemCount > 0) deleteItems = true;

        try {
            await (window as any).electron.invoke('delete-set', { id: setId, deleteItems });
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
        const links: { type: string; url: string }[] = [];
        if (set.patreon_url) links.push({ type: 'patreon', url: set.patreon_url });
        if (set.website_url) links.push({ type: 'website', url: set.website_url });
        if (set.extra_links) {
            try {
                const extra = JSON.parse(set.extra_links);
                if (Array.isArray(extra)) links.push(...extra);
            } catch { }
        }
        if (links.length === 0) links.push({ type: 'patreon', url: '' });

        setEditSetForm({
            name: set.name,
            links
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

    const handleDrop = async (e: React.DragEvent, targetSetId: string) => {
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
                // Moving set into another (hierarchy)
                await (window as any).electron.invoke('move-set', {
                    setId: sourceSetId,
                    targetParentId: targetSetId
                });
                loadCreatorDetails(selectedCreatorId!);
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

    // Auto-scroll logic
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const scrollInterval = React.useRef<NodeJS.Timeout | null>(null);

    const handleContainerDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (!container) return;

        const { top, bottom, height } = container.getBoundingClientRect();
        const y = e.clientY;
        const scrollZone = 80; // Reduced form 100

        if (scrollInterval.current) {
            // Check if we exited the zone, if so stop
            if (y >= top + scrollZone && y <= bottom - scrollZone) {
                clearInterval(scrollInterval.current);
                scrollInterval.current = null;
            }
            return;
        }

        // Scroll Up
        if (y < top + scrollZone) {
            const speed = y < top + 40 ? 10 : 4; // Faster if closer to edge
            scrollInterval.current = setInterval(() => {
                if (container) container.scrollTop -= speed;
            }, 16);
        }
        // Scroll Down
        else if (y > bottom - scrollZone) {
            const speed = y > bottom - 40 ? 10 : 4; // Faster if closer to edge
            scrollInterval.current = setInterval(() => {
                if (container) container.scrollTop += speed;
            }, 16);
        }
    };

    const handleContainerDragLeave = () => {
        if (scrollInterval.current) {
            clearInterval(scrollInterval.current);
            scrollInterval.current = null;
        }
    };

    // Clean up interval on unmount or drop
    useEffect(() => {
        return () => {
            if (scrollInterval.current) clearInterval(scrollInterval.current);
        };
    }, []);

    const handleDropWrapper = (e: React.DragEvent, targetSetId: string) => {
        handleContainerDragLeave(); // Stop scrolling
        handleDrop(e, targetSetId);
    };

    // Derived state
    const filteredCreators = creatorsList
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (creatorSort === 'az') return a.name.localeCompare(b.name);
            if (creatorSort === 'za') return b.name.localeCompare(a.name);
            if (creatorSort === 'items') {
                const aItems = a.sets.reduce((sum, s) => sum + s.itemsCount, 0);
                const bItems = b.sets.reduce((sum, s) => sum + s.itemsCount, 0);
                return bItems - aItems;
            }
            return 0;
        });

    return (
        <div className="flex h-full gap-6 overflow-hidden">
            {/* List Column */}
            <div className="w-1/3 flex flex-col gap-4 min-w-[250px] shrink-0 bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2 flex-grow focus-within:border-brand-primary/50 transition-colors">
                        <Search size={18} className="text-slate-500" />
                        <input
                            type="text"
                            placeholder="Filter creators..."
                            className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setCreatorSort(prev => prev === 'az' ? 'za' : prev === 'za' ? 'items' : 'az')}
                        className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all shadow-lg"
                        title={`Sorting: ${creatorSort.toUpperCase()}`}
                    >
                        {creatorSort === 'az' && <SortAsc size={18} />}
                        {creatorSort === 'za' && <SortDesc size={18} />}
                        {creatorSort === 'items' && <ListFilter size={18} />}
                    </button>
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
                                        <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">{creatorDetails.name}</h2>
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
                                <div className="flex gap-2">
                                    <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
                                        <button
                                            onClick={() => setSetSort(prev => prev === 'az' ? 'za' : prev === 'za' ? 'items' : 'az')}
                                            className="p-1 px-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 hover:bg-white/5 text-slate-400"
                                            title={`Sort Sets: ${setSort.toUpperCase()}`}
                                        >
                                            {setSort === 'az' && <><SortAsc size={12} /> A-Z</>}
                                            {setSort === 'za' && <><SortDesc size={12} /> Z-A</>}
                                            {setSort === 'items' && <><ListFilter size={12} /> Size</>}
                                        </button>
                                        <div className="w-px bg-white/10 my-1 mx-1" />
                                        <button
                                            onClick={() => setItemSort(prev => prev === 'az' ? 'za' : 'az')}
                                            className="p-1 px-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 hover:bg-white/5 text-slate-400"
                                            title={`Sort Items: ${itemSort.toUpperCase()}`}
                                        >
                                            {itemSort === 'az' ? <><SortAsc size={12} /> Items A-Z</> : <><SortDesc size={12} /> Items Z-A</>}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowNewSetInput(true)}
                                        className="flex items-center gap-2 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 hover:border-brand-primary/40 px-4 py-2 rounded-lg text-xs font-bold text-brand-secondary transition-all shadow-lg shadow-brand-primary/5"
                                    >
                                        <FolderPlus size={16} /> New Set
                                    </button>
                                </div>
                            </div>

                            {/* New Set Input */}
                            {showNewSetInput && (
                                <div className="mt-6 flex gap-2 animate-in slide-in-from-top-2 bg-black/40 p-1.5 rounded-lg border border-brand-primary/30 backdrop-blur-md absolute top-20 right-8 z-20 shadow-2xl">
                                    <input
                                        autoFocus
                                        className="bg-transparent border-none rounded-lg px-3 py-2 text-sm w-64 text-slate-200 outline-none placeholder-slate-500"
                                        placeholder={activeParentSetId ? "Sub-set Name..." : "Set Name (e.g. Kitchen, Berlin)"}
                                        value={newSetName}
                                        onChange={e => setNewSetName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                                    />
                                    <button onClick={handleCreateSet} className="bg-brand-primary px-3 rounded-lg text-white hover:bg-brand-secondary transition-colors" title="Create">
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowNewSetInput(false);
                                            setActiveParentSetId(null);
                                        }}
                                        className="bg-white/5 px-3 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                                        title="Cancel"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sets List */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-3"
                            onDragOver={handleContainerDragOver}
                            onDragLeave={(e) => {
                                if (!scrollContainerRef.current?.contains(e.relatedTarget as Node)) {
                                    handleContainerDragLeave();
                                }
                            }}
                        >
                            {(() => {
                                const buildTree = (sets: CreatorSet[]) => {
                                    const tree: (CreatorSet & { children: any[] })[] = [];
                                    const map = new Map();
                                    sets.forEach(s => map.set(s.id, { ...s, children: [] }));
                                    sets.forEach(s => {
                                        if (s.parent_id && map.has(s.parent_id)) {
                                            map.get(s.parent_id).children.push(map.get(s.id));
                                        } else {
                                            tree.push(map.get(s.id));
                                        }
                                    });
                                    // Sort roots
                                    return tree.sort((a, b) => {
                                        if (setSort === 'az') return a.name.localeCompare(b.name);
                                        if (setSort === 'za') return b.name.localeCompare(a.name);
                                        if (setSort === 'items') return (b.items?.length || 0) - (a.items?.length || 0);
                                        return 0;
                                    });
                                };

                                const renderSet = (set: CreatorSet & { children: any[] }, level: number) => {
                                    const sortedChildren = [...set.children].sort((a, b) => {
                                        if (setSort === 'az') return a.name.localeCompare(b.name);
                                        if (setSort === 'za') return b.name.localeCompare(a.name);
                                        if (setSort === 'items') return (b.items?.length || 0) - (a.items?.length || 0);
                                        return 0;
                                    });

                                    const sortedItems = [...(set.items || [])].sort((a, b) => {
                                        if (itemSort === 'az') return a.fileName.localeCompare(b.fileName);
                                        if (itemSort === 'za') return b.fileName.localeCompare(a.fileName);
                                        return 0;
                                    });

                                    return (
                                        <div key={set.id} className={level > 0 ? 'ml-6 mt-3' : ''}>
                                            <div
                                                draggable={editingSetId !== set.id}
                                                onDragStart={(e) => handleSetDragStart(e, set.id)}
                                                className={`
                                                relative bg-white/[0.02] border rounded-xl overflow-hidden transition-all duration-300
                                                ${draggingSetId === set.id ? 'opacity-50 scale-95' : ''}
                                                ${dropTargetSetId === set.id && dropPosition === 'merge'
                                                        ? 'border-brand-primary bg-brand-primary/20 shadow-[0_0_30px_hsl(var(--brand-primary)/0.2)] scale-[1.02]'
                                                        : 'border-white/5 hover:bg-white/[0.04] hover:border-brand-primary/30'}
                                                ${dropTargetSetId === set.id && dropPosition === 'before' ? 'border-t-2 border-t-brand-primary pt-1' : ''}
                                                ${dropTargetSetId === set.id && dropPosition === 'after' ? 'border-b-2 border-b-brand-primary pb-1' : ''}
                                                ${editingSetId === set.id ? 'cursor-default opacity-100' : ''}
                                            `}
                                                onDragOver={(e) => {
                                                    if (editingSetId === set.id) return;
                                                    handleSetDragOver(e, set.id)
                                                }}
                                                onDragLeave={handleSetDragLeave}
                                                onDrop={(e) => {
                                                    if (editingSetId === set.id) return;
                                                    handleDropWrapper(e, set.id);
                                                }}
                                            >
                                                {/* Set Header */}
                                                <div className="py-3 px-4 flex items-center justify-between group">
                                                    <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => toggleSetExpansion(set.id)}>
                                                        {editingSetId !== set.id && (
                                                            <div className="cursor-grab active:cursor-grabbing p-1.5 text-slate-600 hover:text-slate-400" onMouseDown={e => e.stopPropagation()}>
                                                                <GripVertical size={16} />
                                                            </div>
                                                        )}
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
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleUpdateSet(set.id);
                                                                        e.stopPropagation();
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex-grow min-w-0 pr-32 select-text">
                                                                <div className="font-semibold text-slate-200 flex flex-wrap items-center gap-2 break-all leading-snug" title={set.name}>
                                                                    {set.patreon_url || set.website_url ? (
                                                                        <a
                                                                            href={(set.patreon_url || set.website_url) || undefined}
                                                                            target="_blank"
                                                                            onClick={e => e.stopPropagation()}
                                                                            className="hover:text-brand-primary hover:underline decoration-brand-primary/30 underline-offset-4 decoration-2 transition-all cursor-alias"
                                                                        >
                                                                            {set.name}
                                                                        </a>
                                                                    ) : (
                                                                        set.name
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-slate-500 flex gap-4 mt-1.5">
                                                                    <span>{set.items.length} items</span>
                                                                    {(set.patreon_url || set.website_url || set.extra_links) && (
                                                                        <div className="flex gap-1 shrink-0">
                                                                            {set.patreon_url && <a href={set.patreon_url} target="_blank" onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-[#FF424D] transition-colors" title="Patreon"><ExternalLink size={12} /></a>}
                                                                            {set.website_url && <a href={set.website_url} target="_blank" onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-blue-400 transition-colors" title="Website"><Globe size={12} /></a>}
                                                                            {(() => {
                                                                                try {
                                                                                    const extra = set.extra_links ? JSON.parse(set.extra_links) : [];
                                                                                    return extra.map((l: any, i: number) => (
                                                                                        <a key={i} href={l.url} target="_blank" onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-green-400 transition-colors" title={l.type}><Link2 size={12} /></a>
                                                                                    ));
                                                                                } catch { return null; }
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                                                        {editingSetId === set.id ? (
                                                            <div className="flex gap-2 animate-in fade-in bg-black/60 backdrop-blur-sm p-1 rounded-lg border border-white/10">
                                                                <button onClick={() => handleUpdateSet(set.id)} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 border border-green-500/20 transition-colors"><Check size={16} /></button>
                                                                <button onClick={() => setEditingSetId(null)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition-colors"><X size={16} /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 bg-black/60 backdrop-blur-sm p-1 rounded-lg border border-white/10 shadow-xl">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleSetSelection(set, selectedItems);
                                                                    }}
                                                                    className={`p-2 rounded-lg border transition-all ${set.items.length > 0 && set.items.every(i => selectedItems.has(i.id))
                                                                        ? 'bg-brand-primary/20 border-brand-primary/30 text-brand-secondary'
                                                                        : 'hover:bg-white/10 border-transparent text-slate-500 hover:text-white'
                                                                        }`}
                                                                    title="Select all items in set"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveParentSetId(set.id);
                                                                        setShowNewSetInput(true);
                                                                    }}
                                                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-green-400 transition-colors"
                                                                    title="Add sub-set"
                                                                >
                                                                    <FolderPlus size={16} />
                                                                </button>
                                                                {set.parent_id && (
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            await (window as any).electron.invoke('move-set', {
                                                                                setId: set.id,
                                                                                targetParentId: null
                                                                            });
                                                                            loadCreatorDetails(selectedCreatorId!);
                                                                        }}
                                                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-brand-secondary transition-colors"
                                                                        title="Move to root"
                                                                    >
                                                                        <ArrowUp size={16} />
                                                                    </button>
                                                                )}
                                                                <button onClick={() => startEditingSet(set)} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-brand-primary transition-colors">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button onClick={() => handleDeleteSet(set.id)} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Set Edit Panel (Links) */}
                                                {editingSetId === set.id && (
                                                    <div className="px-4 pb-4 pl-14 space-y-3 bg-black/20 pt-2 animate-in slide-in-from-top-1">
                                                        {editSetForm.links.map((link, idx) => (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <div className="relative shrink-0 w-24">
                                                                    <select
                                                                        className="w-full bg-black/20 border border-white/5 rounded-lg px-2 py-2 text-xs text-slate-300 outline-none appearance-none"
                                                                        value={link.type}
                                                                        onChange={e => {
                                                                            const newLinks = [...editSetForm.links];
                                                                            newLinks[idx].type = e.target.value;
                                                                            setEditSetForm({ ...editSetForm, links: newLinks });
                                                                        }}
                                                                    >
                                                                        <option value="patreon">Patreon</option>
                                                                        <option value="website">Website</option>
                                                                        <option value="tumblr">Tumblr</option>
                                                                        <option value="curseforge">CurseForge</option>
                                                                        <option value="other">Other</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex-grow flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/5 focus-within:border-brand-primary/30 transition-colors">
                                                                    <input
                                                                        className="bg-transparent border-none outline-none text-xs w-full text-slate-300 placeholder-slate-600"
                                                                        placeholder="URL"
                                                                        value={link.url}
                                                                        onChange={e => {
                                                                            const newLinks = [...editSetForm.links];
                                                                            newLinks[idx].url = e.target.value;
                                                                            setEditSetForm({ ...editSetForm, links: newLinks });
                                                                        }}
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const newLinks = editSetForm.links.filter((_, i) => i !== idx);
                                                                        setEditSetForm({ ...editSetForm, links: newLinks });
                                                                    }}
                                                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => setEditSetForm({ ...editSetForm, links: [...editSetForm.links, { type: 'other', url: '' }] })}
                                                            className="text-xs flex items-center gap-2 text-brand-secondary hover:text-white px-2 py-1 hover:bg-white/5 rounded-lg transition-colors"
                                                        >
                                                            <FolderPlus size={12} /> Add Link
                                                        </button>
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
                                                                <div
                                                                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer hover:border-brand-primary/60 ${selectedItems.has(item.id) ? 'bg-brand-primary border-brand-primary' : 'border-slate-600 bg-black/20'}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleItemSelection(item.id, true);
                                                                    }}
                                                                >
                                                                    {selectedItems.has(item.id) && <Check size={11} className="text-white" />}
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
                                            {/* Recursive Children */}
                                            {expandedSets.has(set.id) && sortedChildren.map(child => renderSet(child, level + 1))}
                                        </div>
                                    );
                                };

                                const tree = buildTree(creatorDetails.sets);
                                return tree.map(set => renderSet(set, 0));
                            })()}
                        </div>

                        {/* Selection Toolbar */}
                        {selectedItems.size > 0 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-bg-card/90 backdrop-blur-xl border border-brand-primary/30 py-2 px-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 z-30">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest">{selectedItems.size} Selected</span>
                                    <span className="text-[8px] text-slate-500">Items to manage</span>
                                </div>
                                <div className="w-px h-6 bg-white/10" />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowMoveModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-brand-primary/20"
                                    >
                                        <Move size={14} /> Move to Set
                                    </button>
                                    <button
                                        onClick={() => setSelectedItems(new Set())}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        <X size={14} /> Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Move to Set Modal */}
                        {showMoveModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                                <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                                    <div className="flex justify-between items-center px-8 py-6 border-b border-white/5 bg-white/5">
                                        <h2 className="text-xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                                            Move Items
                                        </h2>
                                        <button onClick={() => setShowMoveModal(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="p-6 border-b border-white/5">
                                        <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2 focus-within:border-brand-primary/50 transition-colors">
                                            <Search size={18} className="text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="Search destination set..."
                                                className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-500"
                                                value={moveSearch}
                                                onChange={(e) => setMoveSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-2">
                                        {creatorDetails.sets
                                            .filter(s => s.name.toLowerCase().includes(moveSearch.toLowerCase()))
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(set => (
                                                <button
                                                    key={set.id}
                                                    onClick={() => {
                                                        handleMoveItems(set.id, Array.from(selectedItems));
                                                        setShowMoveModal(false);
                                                        setMoveSearch('');
                                                    }}
                                                    className="w-full p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all text-left flex items-center justify-between group"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-200 group-hover:text-brand-secondary">{set.name}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{set.items?.length || 0} items</span>
                                                    </div>
                                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-brand-primary" />
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}
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
