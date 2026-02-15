import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search, Filter, Plus, Trash2, Edit2, ExternalLink, Globe,
    MoreVertical, X, Check, FolderPlus, File as FileIcon,
    ChevronRight, ChevronDown, GripVertical, ListFilter, SortAsc, SortDesc, ArrowRight, ArrowUpDown,
    UserPlus, Save, Link2, ArrowUp, Move, CheckCircle
} from 'lucide-react';

interface Item {
    id: string;
    fileName: string;
    extra_links?: string;
    release_date?: string;
    sort_order?: number;
    displayName?: string;
}

interface CreatorSet {
    id: string;
    name: string;
    parent_id?: string | null;
    patreon_url?: string | null;
    website_url?: string | null;
    extra_links?: string | null;
    sort_order?: number;
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

interface CreatorsViewProps {
    refreshTrigger?: number;
}

// Helper function for array reordering
const arrayMove = (arr: any[], oldIndex: number, newIndex: number) => {
    if (newIndex >= arr.length) {
        let k = newIndex - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
    return arr;
};

const countTotalItems = (set: any, allSets: any[]): number => {
    let count = set.items?.length || 0;
    const children = allSets.filter(s => s.parent_id === set.id);
    children.forEach(child => {
        count += countTotalItems(child, allSets);
    });
    return count;
};

const CreatorsView: React.FC<CreatorsViewProps> = ({ refreshTrigger }) => {
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
    const [lastSelectedItemId, setLastSelectedItemId] = useState<string | null>(null);
    const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
    const [editingSetId, setEditingSetId] = useState<string | null>(null);

    // Creator Editing
    const [editingCreator, setEditingCreator] = useState(false);
    const [creatorForm, setCreatorForm] = useState({ name: '', patreon_url: '', website_url: '' });

    // Forms
    const [editSetForm, setEditSetForm] = useState<{ name: string; links: { type: string; url: string }[] }>({ name: '', links: [] });
    const [newSetName, setNewSetName] = useState('');
    const [newSetPatreon, setNewSetPatreon] = useState('');
    const [newSetWebsite, setNewSetWebsite] = useState('');
    const [showNewSetInput, setShowNewSetInput] = useState(false);
    const [activeParentSetId, setActiveParentSetId] = useState<string | null>(null);
    const [showNewCreatorInput, setShowNewCreatorInput] = useState(false);
    const [newCreatorName, setNewCreatorName] = useState('');

    // Sorting State
    const [creatorSort, setCreatorSort] = useState<'az' | 'za' | 'items'>('az');
    const [setSort, setSetSort] = useState<'az' | 'za' | 'items' | 'custom'>('custom');
    const [itemSort, setItemSort] = useState<'az' | 'za'>('az');

    // Move to Set Modal State
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveSearch, setMoveSearch] = useState('');

    // Merge/Nest Option UI
    const [mergeOptionModal, setMergeOptionModal] = useState<{ show: boolean, sourceId: string | null, targetId: string | null }>({ show: false, sourceId: null, targetId: null });

    // Creator Drop Target
    const [dropTargetCreatorId, setDropTargetCreatorId] = useState<string | null>(null);

    const handleMergeOption = async (action: 'nest' | 'merge') => {
        const { sourceId, targetId } = mergeOptionModal;
        if (!sourceId || !targetId) return;

        if (action === 'nest') {
            await (window as any).electron.invoke('move-set', {
                setId: sourceId,
                targetParentId: targetId
            });
        } else {
            await (window as any).electron.invoke('merge-sets', {
                sourceSetId: sourceId,
                targetSetId: targetId
            });
        }

        setMergeOptionModal({ show: false, sourceId: null, targetId: null });
        loadCreatorDetails(selectedCreatorId || '');
    };

    const handleCreatorDragOver = (e: React.DragEvent, creatorId: string) => {
        if (!draggingSetId) return; // Only allow dragging SETS onto creators
        if (selectedCreatorId === creatorId) return; // Don't move to same creator
        e.preventDefault();
        setDropTargetCreatorId(creatorId);
    };

    const handleCreatorDrop = async (e: React.DragEvent, targetCreatorId: string) => {
        e.preventDefault();
        if (!draggingSetId) return;

        if (confirm('Move this set to ' + creatorsList.find(c => c.id === targetCreatorId)?.name + '?')) {
            await (window as any).electron.invoke('move-set', {
                setId: draggingSetId,
                targetCreatorId: targetCreatorId
            });

            // Reload details (current creator will lose the set)
            loadCreatorsList();
            if (selectedCreatorId) loadCreatorDetails(selectedCreatorId);
        }

        setDropTargetCreatorId(null);
        setDraggingSetId(null);
    };

    // Memoized sorted sets tree
    const sortedSetsTree = useMemo(() => {
        if (!creatorDetails) return [];
        const sets = creatorDetails.sets;
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

        const sortFn = (a: any, b: any) => {
            if (setSort === 'custom') return (a.sort_order || 0) - (b.sort_order || 0);
            if (setSort === 'az') return a.name.localeCompare(b.name);
            if (setSort === 'za') return b.name.localeCompare(a.name);
            if (setSort === 'items') return countTotalItems(b, sets) - countTotalItems(a, sets);
            return 0;
        };

        const recursiveSort = (nodes: any[]) => {
            nodes.sort(sortFn);
            nodes.forEach(n => recursiveSort(n.children));
        };

        recursiveSort(tree);
        return tree;
    }, [creatorDetails, setSort]);

    const renderSet = (set: CreatorSet & { children: any[] }, level: number) => {
        const sortedItems = [...(set.items || [])].sort((a, b) => {
            if (itemSort === 'az') return a.fileName.localeCompare(b.fileName);
            if (itemSort === 'za') return b.fileName.localeCompare(a.fileName);
            return 0;
        });

        return (
            <div key={set.id} className={level > 0 ? 'ml-6 border-l border-white/5 pl-2' : 'mt-3'}>
                <div
                    id={`set-${set.id}`}
                    className={`
                    relative border rounded-xl overflow-hidden transition-all duration-300
                    ${level > 0 ? 'bg-transparent border-transparent' : 'bg-white/[0.02] border-white/5'}
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
                                <div
                                    draggable={true}
                                    onDragStart={(e) => {
                                        handleSetDragStart(e, set.id);
                                        const container = document.getElementById(`set-${set.id}`);
                                        if (container) {
                                            e.dataTransfer.setDragImage(container, 0, 0);
                                        }
                                    }}
                                    className="cursor-grab active:cursor-grabbing p-1.5 text-slate-600 hover:text-slate-400"
                                    onClick={e => e.stopPropagation()}
                                    onMouseDown={e => e.stopPropagation()}
                                >
                                    <GripVertical size={16} />
                                </div>
                            )}
                            <div className={`p-1.5 rounded-lg transition-colors ${expandedSets.has(set.id) ? 'bg-white/10 text-white' : 'text-slate-500 group-hover:bg-white/5 group-hover:text-slate-300'}`}>
                                {expandedSets.has(set.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>

                            {/* Set Selection Checkbox */}
                            <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer hover:border-brand-primary/60 shrink-0 ${(() => {
                                    const itemIds = (set.items || []).map(i => i.id);
                                    const anySelected = itemIds.some(id => selectedItems.has(id));
                                    const allSelected = itemIds.length > 0 && itemIds.every(id => selectedItems.has(id));
                                    return allSelected ? 'bg-brand-primary border-brand-primary' : anySelected ? 'border-brand-primary bg-brand-primary/20' : 'border-slate-600 bg-black/20';
                                })()}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSetSelection(set, selectedItems);
                                }}
                            >
                                {(() => {
                                    const itemIds = (set.items || []).map(i => i.id);
                                    const allSelected = itemIds.length > 0 && itemIds.every(id => selectedItems.has(id));
                                    const anySelected = itemIds.some(id => selectedItems.has(id));
                                    if (allSelected) return <Check size={11} className="text-white" />;
                                    if (anySelected) return <div className="w-2 h-0.5 bg-brand-primary" />;
                                    return null;
                                })()}
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
                                                href={set.patreon_url || set.website_url || '#'}
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
                                        <span>{countTotalItems(set, creatorDetails!.sets)} items</span>
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
                                            setEditingSetId(set.id);
                                            setEditSetForm({
                                                name: set.name,
                                                links: [
                                                    ...(set.patreon_url ? [{ type: 'patreon', url: set.patreon_url }] : []),
                                                    ...(set.website_url ? [{ type: 'website', url: set.website_url }] : []),
                                                    ...(() => {
                                                        try {
                                                            return set.extra_links ? JSON.parse(set.extra_links) : [];
                                                        } catch { return []; }
                                                    })()
                                                ]
                                            });
                                        }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-brand-primary transition-colors" title="Edit Set"
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveParentSetId(set.id);
                                            setShowNewSetInput(true);
                                        }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-brand-secondary transition-colors" title="Add Sub-set"
                                    >
                                        <FolderPlus size={15} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSet(set.id);
                                        }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors" title="Delete Set"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Edit Form - Inline Links */}
                    {editingSetId === set.id && (
                        <div className="p-4 space-y-3 bg-brand-primary/5 border-t border-white/5 animate-in slide-in-from-top-1 duration-200">
                            {editSetForm.links.map((link, idx) => (
                                <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms` }}>
                                    <select
                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-[10px] text-slate-400 outline-none focus:border-brand-primary/30"
                                        value={link.type}
                                        onChange={e => {
                                            const newLinks = [...editSetForm.links];
                                            newLinks[idx].type = e.target.value;
                                            setEditSetForm({ ...editSetForm, links: newLinks });
                                        }}
                                    >
                                        <option value="patreon">Patreon</option>
                                        <option value="website">Website</option>
                                        <option value="other">Other</option>
                                    </select>
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

                    {/* Set Expanded Context */}
                    {expandedSets.has(set.id) && (
                        <div className="">
                            {/* Items List (Collapsible) */}
                            <div className="min-h-[40px]">
                                {sortedItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`px-4 py-2.5 flex items-center gap-3 text-sm transition-all cursor-grab active:cursor-grabbing border-l-[3px] select-none group/item ${selectedItems.has(item.id)
                                            ? 'border-brand-primary bg-brand-primary/10 text-white'
                                            : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                            }`}
                                        onClick={(e) => toggleItemSelection(item.id, e.ctrlKey || e.metaKey || e.shiftKey, e.shiftKey, allVisibleItems)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id)}
                                    >
                                        <GripVertical size={14} className="text-slate-600 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                                        <div
                                            className={`w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer hover:border-brand-primary/60 ${selectedItems.has(item.id) ? 'bg-brand-primary border-brand-primary' : 'border-slate-600 bg-black/20'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleItemSelection(item.id, true, false, allVisibleItems);
                                            }}
                                        >
                                            {selectedItems.has(item.id) && <Check size={11} className="text-white" />}
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium truncate max-w-md">{item.fileName}</span>
                                            {item.release_date && <span className="text-[10px] text-slate-500">Released: {item.release_date}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Recursive Children */}
                            {set.children.map(child => renderSet(child, level + 1))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Flattened list of ONLY visible items in visual order
    const allVisibleItems = useMemo(() => {
        const list: any[] = [];
        const process = (nodes: any[]) => {
            nodes.forEach(node => {
                // 1. Add items of this set (sorted) ONLY if expanded
                if (expandedSets.has(node.id)) {
                    const sortedItems = [...(node.items || [])].sort((a, b) => {
                        if (itemSort === 'az') return a.fileName.localeCompare(b.fileName);
                        if (itemSort === 'za') return b.fileName.localeCompare(a.fileName);
                        return 0;
                    });
                    list.push(...sortedItems);

                    // 2. Add children if expanded
                    process(node.children);
                }
            });
        };
        process(sortedSetsTree);
        return list;
    }, [sortedSetsTree, expandedSets, itemSort]);

    useEffect(() => {
        loadCreatorsList();
    }, [refreshTrigger]);

    useEffect(() => {
        if (selectedCreatorId) {
            loadCreatorDetails(selectedCreatorId);
            setSelectedItems(new Set());
            setSelectionAnchor(null);
            setLastSelectedItemId(null);
        }
    }, [selectedCreatorId, refreshTrigger]);

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
                name: data.name,
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

    const toggleItemSelection = (itemId: string, multiSelect: boolean, rangeSelect: boolean, context: any[] = allVisibleItems) => {
        let newSelected = new Set<string>();

        if (rangeSelect && selectionAnchor && context) {
            const anchorIdx = context.findIndex(i => i.id === selectionAnchor);
            const currentIdx = context.findIndex(i => i.id === itemId);

            if (anchorIdx !== -1 && currentIdx !== -1) {
                // Perfect range selection
                // If it's a Ctrl+Shift click, we append to existing. If just Shift, we start from anchor.
                if (multiSelect && !rangeSelect) { /* This shouldn't happen with current onClick */ }

                // In standard behavior, Shift-click maintains other selections if Ctrl was also held
                // otherwise it usually starts fresh or adds to current.
                // We'll follow the most common pattern: 
                // 1. If multiSelect (Ctrl/Cmd) is held, we start with current selections.
                // 2. We ADD the range between anchor and current.
                newSelected = new Set(multiSelect ? selectedItems : []);

                const start = Math.min(anchorIdx, currentIdx);
                const end = Math.max(anchorIdx, currentIdx);
                const range = context.slice(start, end + 1);
                range.forEach(i => newSelected.add(i.id));
            } else {
                // Fallback to single or toggle
                newSelected = new Set(multiSelect ? selectedItems : []);
                if (newSelected.has(itemId)) newSelected.delete(itemId);
                else newSelected.add(itemId);
                setSelectionAnchor(itemId);
            }
        } else {
            // Normal click or toggle
            if (multiSelect) {
                newSelected = new Set(selectedItems);
                if (newSelected.has(itemId)) newSelected.delete(itemId);
                else newSelected.add(itemId);
            } else {
                newSelected = new Set([itemId]);
            }
            // Always set anchor on a fresh non-range click
            setSelectionAnchor(itemId);
        }

        setSelectedItems(newSelected);
        setLastSelectedItemId(itemId);
    };

    const toggleSetSelection = (set: CreatorSet, currentSelected: Set<string>) => {
        const itemIds = (set.items || []).map(i => i.id);
        const allSelected = itemIds.length > 0 && itemIds.every(id => currentSelected.has(id));

        const newSelected = new Set(currentSelected);
        if (allSelected) {
            itemIds.forEach(id => newSelected.delete(id));
        } else {
            itemIds.forEach(id => newSelected.add(id));
            // Set anchor to the first item of the set if we just selected it
            if (itemIds.length > 0) setSelectionAnchor(itemIds[0]);
        }
        setSelectedItems(newSelected);
    };

    const handleDeleteCreator = async () => {
        if (!selectedCreatorId || !creatorDetails) return;

        const setIds = creatorDetails.sets.map(s => s.id);
        const hasSets = setIds.length > 0;
        let deleteSets = false;

        const message = hasSets
            ? `This creator has ${setIds.length} sets. To delete the creator, you must also delete all their sets and items. This cannot be undone.\n\nAre you sure you want to delete ${creatorDetails.name}?`
            : `Are you sure you want to delete ${creatorDetails.name}?`;

        if (!confirm(message)) return;

        if (hasSets) deleteSets = true;

        try {
            await (window as any).electron.invoke('delete-creator', { id: selectedCreatorId, deleteSets });
            setSelectedCreatorId(null);
            setCreatorDetails(null);
            loadCreatorsList();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCreateCreator = async () => {
        if (!newCreatorName.trim()) return;
        try {
            const result = await (window as any).electron.invoke('create-creator', {
                name: newCreatorName
            });
            setNewCreatorName('');
            setShowNewCreatorInput(false);
            loadCreatorsList();
            setSelectedCreatorId(result.id);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCreateSet = async () => {
        if (!newSetName.trim() || !selectedCreatorId) return;
        await (window as any).electron.invoke('create-set', {
            creatorId: selectedCreatorId,
            name: newSetName,
            parentId: activeParentSetId,
            patreonUrl: newSetPatreon.trim() || null,
            websiteUrl: newSetWebsite.trim() || null
        });
        setNewSetName('');
        setNewSetPatreon('');
        setNewSetWebsite('');
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

    const handleDeleteSelectedItems = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedItems.size} selected items?`)) return;

        try {
            await (window as any).electron.invoke('delete-items', {
                itemIds: Array.from(selectedItems)
            });
            setSelectedItems(new Set());
            loadCreatorDetails(selectedCreatorId!);
        } catch (e: any) {
            alert(e.message);
        }
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
            if (!sourceSetId || sourceSetId === targetSetId) {
                setDraggingSetId(null);
                setDropTargetSetId(null);
                setDropPosition(null);
                return;
            }

            if (dropPosition === 'merge') {
                // Trigger option modal instead of automatic action
                setMergeOptionModal({ show: true, sourceId: draggingSetId, targetId: targetSetId });
            } else if ((dropPosition === 'before' || dropPosition === 'after') && setSort === 'custom') {
                if (!creatorDetails) return;

                // Sort sets by current sort_order to ensure we are moving in the visual list
                const currentSets = [...creatorDetails.sets].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                const sourceIndex = currentSets.findIndex(s => s.id === sourceSetId);
                const targetIndex = currentSets.findIndex(s => s.id === targetSetId);

                if (sourceIndex !== -1 && targetIndex !== -1) {
                    const newSets = [...currentSets];
                    const [moved] = newSets.splice(sourceIndex, 1);

                    // Calculate insertion index
                    let insertAt = targetIndex;
                    if (sourceIndex < targetIndex) insertAt--;
                    if (dropPosition === 'after') insertAt++;

                    newSets.splice(insertAt, 0, moved);

                    // Now map to sort orders
                    const updates = newSets.map((s, index) => ({ id: s.id, sortOrder: index }));

                    // Optimistic update
                    setCreatorDetails({
                        ...creatorDetails,
                        sets: creatorDetails.sets.map(s => {
                            const u = updates.find(up => up.id === s.id);
                            return u ? { ...s, sort_order: u.sortOrder } : s;
                        })
                    });

                    await (window as any).electron.invoke('update-set-order', updates);
                }
            }
        }

        setDraggingSetId(null);
        setDropTargetSetId(null);
        setDropPosition(null);
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
                        {creatorSort === 'items' && <ListFilter size={18} />}
                    </button>
                    <button
                        onClick={() => setShowNewCreatorInput(!showNewCreatorInput)}
                        className={`p-3 border rounded-xl transition-all shadow-lg ${showNewCreatorInput ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="Add Creator"
                    >
                        <UserPlus size={18} />
                    </button>
                </div>

                {/* New Creator Input */}
                {showNewCreatorInput && (
                    <div className="mx-4 mb-2 p-3 bg-black/20 border border-brand-primary/30 rounded-xl animate-in slide-in-from-top-2 flex gap-2 backdrop-blur-md">
                        <input
                            autoFocus
                            className="bg-transparent border-none outline-none text-sm flex-grow text-slate-200 placeholder-slate-500"
                            placeholder="New creator name..."
                            value={newCreatorName}
                            onChange={e => setNewCreatorName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateCreator()}
                        />
                        <button onClick={handleCreateCreator} className="text-brand-primary hover:text-white transition-colors" title="Save">
                            <Check size={18} />
                        </button>
                    </div>
                )}

                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredCreators.map(creator => (
                        <div
                            key={creator.id}
                            onClick={() => setSelectedCreatorId(creator.id)}
                            onDragOver={(e) => handleCreatorDragOver(e, creator.id)}
                            onDragLeave={() => setDropTargetCreatorId(null)}
                            onDrop={(e) => handleCreatorDrop(e, creator.id)}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border group relative overflow-hidden ${dropTargetCreatorId === creator.id ? 'bg-brand-primary/20 border-brand-primary border-dashed scale-[1.02] shadow-[0_0_20px_hsl(var(--brand-primary)/0.3)]' :
                                    selectedCreatorId === creator.id
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
                                            <div className="col-span-2 flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/5 focus-within:border-brand-primary/50 transition-colors">
                                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider shrink-0 w-16">Name</span>
                                                <input
                                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-600 font-bold"
                                                    placeholder="Creator Name"
                                                    value={creatorForm.name}
                                                    onChange={e => setCreatorForm({ ...creatorForm, name: e.target.value })}
                                                />
                                            </div>
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
                                            <div className="col-span-2 flex justify-between items-center mt-2">
                                                <button
                                                    onClick={handleDeleteCreator}
                                                    className="text-red-400 text-xs hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <Trash2 size={14} /> Delete Creator
                                                </button>
                                                <button
                                                    onClick={handleUpdateCreator}
                                                    className="bg-brand-primary text-white text-xs font-bold px-6 py-2.5 rounded-lg hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 flex items-center gap-2"
                                                >
                                                    <Save size={14} /> Save Changes
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
                                            onClick={() => {
                                                const allIds = new Set<string>();
                                                creatorDetails?.sets.forEach(s => s.items.forEach(i => allIds.add(i.id)));
                                                setSelectedItems(allIds);
                                            }}
                                            className="p-1 px-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 hover:bg-white/5 text-slate-400"
                                            title="Select all items of this creator"
                                        >
                                            <CheckCircle size={12} /> Select All
                                        </button>
                                        <div className="w-px bg-white/10 my-1 mx-1" />
                                        <button
                                            onClick={() => setSetSort(prev => prev === 'custom' ? 'az' : prev === 'az' ? 'za' : prev === 'za' ? 'items' : 'custom')}
                                            className="p-1 px-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 hover:bg-white/5 text-slate-400"
                                            title={`Sort Sets: ${setSort.toUpperCase()}`}
                                        >
                                            {setSort === 'custom' && <><ArrowUpDown size={12} /> Custom</>}
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
                                <div className="mt-6 flex flex-col gap-2 animate-in slide-in-from-top-2 bg-black/60 p-4 rounded-xl border border-brand-primary/30 backdrop-blur-xl absolute top-20 right-8 z-20 shadow-2xl min-w-[320px]">
                                    <div className="flex items-center gap-2 p-2 bg-black/40 rounded-lg border border-white/5 focus-within:border-brand-primary/50 transition-colors">
                                        <FolderPlus size={16} className="text-slate-500 shrink-0" />
                                        <input
                                            autoFocus
                                            className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder-slate-600"
                                            placeholder={activeParentSetId ? "Sub-set Name..." : "Set Name (e.g. Kitchen, Berlin)"}
                                            value={newSetName}
                                            onChange={e => setNewSetName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-black/40 rounded-lg border border-white/5 focus-within:border-brand-primary/50 transition-colors">
                                        <ExternalLink size={14} className="text-slate-500 shrink-0" />
                                        <input
                                            className="bg-transparent border-none outline-none text-xs w-full text-slate-200 placeholder-slate-600"
                                            placeholder="Patreon URL (optional)"
                                            value={newSetPatreon}
                                            onChange={e => setNewSetPatreon(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-black/40 rounded-lg border border-white/5 focus-within:border-brand-primary/50 transition-colors">
                                        <Globe size={14} className="text-slate-500 shrink-0" />
                                        <input
                                            className="bg-transparent border-none outline-none text-xs w-full text-slate-200 placeholder-slate-600"
                                            placeholder="Website URL (optional)"
                                            value={newSetWebsite}
                                            onChange={e => setNewSetWebsite(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={handleCreateSet} className="flex-grow bg-brand-primary text-white py-2 rounded-lg hover:bg-brand-secondary transition-all font-bold text-xs shadow-lg shadow-brand-primary/20">
                                            Create Set
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowNewSetInput(false);
                                                setActiveParentSetId(null);
                                                setNewSetName('');
                                                setNewSetPatreon('');
                                                setNewSetWebsite('');
                                            }}
                                            className="bg-white/5 px-4 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
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
                            {sortedSetsTree.map(set => renderSet(set, 0))}
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
                                <Move size={14} /> Move
                            </button>
                            <button
                                onClick={handleDeleteSelectedItems}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all"
                            >
                                <Trash2 size={14} /> Delete
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
                {showMoveModal && creatorDetails && (
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
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{countTotalItems(set, creatorDetails.sets)} items</span>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-600 group-hover:text-brand-primary" />
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Merge/Nest Option Modal */}
                {mergeOptionModal.show && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                        <div className="bg-bg-card border border-border-subtle rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-6">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto text-brand-primary mb-2">
                                    <FolderPlus size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Organize Sets</h3>
                                <p className="text-sm text-slate-400">How would you like to handle this drop?</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => handleMergeOption('nest')}
                                    className="p-4 bg-brand-primary/10 border border-brand-primary/30 hover:border-brand-primary hover:bg-brand-primary/20 rounded-xl transition-all flex items-center gap-4 group text-left"
                                >
                                    <div className="bg-brand-primary/20 p-2 rounded-lg text-brand-primary group-hover:scale-110 transition-transform">
                                        <FolderPlus size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-brand-secondary">Nest as Sub-folder</div>
                                        <div className="text-xs text-slate-500">Move inside as a child folder</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleMergeOption('merge')}
                                    className="p-4 bg-white/5 border border-white/10 hover:border-brand-primary/30 hover:bg-white/10 rounded-xl transition-all flex items-center gap-4 group text-left"
                                >
                                    <div className="bg-white/10 p-2 rounded-lg text-slate-300 group-hover:scale-110 transition-transform">
                                        <ArrowRight size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-200">Merge Contents</div>
                                        <div className="text-xs text-slate-500">Combine items into one folder</div>
                                    </div>
                                </button>
                            </div>

                            <button
                                onClick={() => setMergeOptionModal({ show: false, sourceId: null, targetId: null })}
                                className="w-full py-3 rounded-xl bg-transparent hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatorsView;
