import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Link2, UserPlus, X, ChevronDown, ChevronRight, Check, Search, FolderPlus, ArrowRight, Package, Upload } from 'lucide-react';

export interface CreatorMatch {
    foundName: string;
    existingName?: string;
    existingId?: string;
    similarity: number;
    needsConfirmation: boolean;
}

export interface DuplicateItem {
    fileName: string;
    existingCreatorName: string;
    existingSetName: string;
    existingSetHierarchy: string[];
}

export interface ScanResult { // Renamed from CCItem to match logic
    creatorName: string;
    setHierarchy: string[];
    fileName: string;
    setName?: string; // Legacy
}

export interface ScanAnalysis {
    results: ScanResult[];
    matches: CreatorMatch[];
    duplicates?: DuplicateItem[];
    filePath?: string;
    category?: 'buildings' | 'uploads';
}

interface ScanConfirmationModalProps {
    analysis: ScanAnalysis;
    onConfirm: (finalAnalysis: ScanAnalysis) => void;
    onCancel: () => void;
    creatorsList: any[]; // Pass existing creators for dropdowns
}

type CreatorAction = 'new' | 'existing' | 'rename';

interface CreatorDecision {
    originalName: string;
    action: CreatorAction;
    targetName: string; // For 'new' or 'rename'
    targetId?: string; // For 'existing'
    setDecisions: Record<string, SetDecision>; // Keyed by original set name
}

type SetAction = 'new' | 'existing' | 'rename';

interface SetDecision {
    originalName: string;
    action: SetAction;
    targetName: string;
    targetId?: string;
}

const ScanConfirmationModal: React.FC<ScanConfirmationModalProps> = ({ analysis, onConfirm, onCancel, creatorsList }) => {
    // 1. Initialize decisions based on analysis
    const [decisions, setDecisions] = useState<Record<string, CreatorDecision>>({});
    const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [category, setCategory] = useState<'buildings' | 'uploads'>('uploads');

    useEffect(() => {
        const initialDecisions: Record<string, CreatorDecision> = {};

        // Group items by creator to identify sets
        const setsByCreator: Record<string, Set<string>> = {};
        analysis.results.forEach(item => {
            if (!setsByCreator[item.creatorName]) setsByCreator[item.creatorName] = new Set();
            const rootSet = item.setHierarchy && item.setHierarchy.length > 0 ? item.setHierarchy[0] : 'Unsorted';
            setsByCreator[item.creatorName].add(rootSet);
        });

        // Loop through matches (creators)
        analysis.matches.forEach(match => {
            const currentSets = setsByCreator[match.foundName] || new Set();
            const setDecisions: Record<string, SetDecision> = {};

            currentSets.forEach(setName => {
                setDecisions[setName] = {
                    originalName: setName,
                    action: 'new',
                    targetName: setName
                };
            });

            // Default logic: if high similarity match found, suggest existing
            // otherwise 'new'
            let action: CreatorAction = 'new';
            let targetId: string | undefined = undefined;
            let targetName = match.foundName;

            if (match.existingId && match.similarity > 0.8) {
                action = 'existing';
                targetId = match.existingId;
                targetName = match.existingName || match.foundName;
            }

            initialDecisions[match.foundName] = {
                originalName: match.foundName,
                action,
                targetName,
                targetId,
                setDecisions
            };
        });

        setDecisions(initialDecisions);
        // Expand all by default if there are few, or just the ones needing review
        if (analysis.matches.length < 5) {
            setExpandedCreators(new Set(analysis.matches.map(m => m.foundName)));
        }
    }, [analysis]);

    const handleCreatorActionChange = (creatorName: string, action: CreatorAction) => {
        setDecisions(prev => {
            const current = prev[creatorName];
            // If switching to 'existing', and we have sets named "Unsorted" or "General",
            // default their targetName to the original creator name (often the folder name)
            let newSetDecisions = { ...current.setDecisions };
            if (action === 'existing') {
                Object.keys(newSetDecisions).forEach(setName => {
                    const setDec = newSetDecisions[setName];
                    if (['unsorted', 'general'].includes(setDec.originalName.toLowerCase())) {
                        newSetDecisions[setName] = {
                            ...setDec,
                            targetName: creatorName // Use the Found Creator Name (Folder) as Set Name
                        };
                    }
                });
            } else if (action === 'new') {
                // Revert to original name if switching back to new? Or keep as is.
                // Better to revert to original to avoid confusion if they switch back
                Object.keys(newSetDecisions).forEach(setName => {
                    const setDec = newSetDecisions[setName];
                    if (['unsorted', 'general'].includes(setDec.originalName.toLowerCase()) && setDec.targetName === creatorName) {
                        newSetDecisions[setName] = {
                            ...setDec,
                            targetName: setDec.originalName
                        };
                    }
                });
            }

            return {
                ...prev,
                [creatorName]: {
                    ...current,
                    action,
                    // Reset target fields based on action if needed, or keep previous defaults
                    targetId: action === 'existing' ? prev[creatorName].targetId : undefined,
                    setDecisions: newSetDecisions
                }
            };
        });
    };

    const handleCreatorTargetChange = (creatorName: string, id: string) => {
        const selected = creatorsList.find(c => c.id === id);
        setDecisions(prev => {
            const current = prev[creatorName];

            // Allow checking if the Found Creator Name already exists as a SET in the new target creator?
            // Advanced: if "Felixandre..." exists as a set in "Felixsandr", auto-select it.
            let newSetDecisions = { ...current.setDecisions };
            if (selected) {
                Object.keys(newSetDecisions).forEach(setName => {
                    const setDec = newSetDecisions[setName];
                    // Name to check: either current target name or original Creator Name (if it was unsorted)
                    const nameToCheck = (['unsorted', 'general'].includes(setDec.originalName.toLowerCase()))
                        ? creatorName
                        : setDec.targetName;

                    const existingSet = selected.sets.find((s: any) => s.name.toLowerCase() === nameToCheck.toLowerCase());

                    if (existingSet) {
                        newSetDecisions[setName] = {
                            ...setDec,
                            targetName: existingSet.name,
                            action: 'existing',
                            targetId: existingSet.id
                        };
                    }
                });
            }

            return {
                ...prev,
                [creatorName]: {
                    ...current,
                    targetId: id,
                    targetName: selected ? selected.name : prev[creatorName].targetName,
                    setDecisions: newSetDecisions
                }
            };
        });
    };

    const handleSetActionChange = (creatorName: string, setName: string, action: SetAction) => {
        setDecisions(prev => ({
            ...prev,
            [creatorName]: {
                ...prev[creatorName],
                setDecisions: {
                    ...prev[creatorName].setDecisions,
                    [setName]: {
                        ...prev[creatorName].setDecisions[setName],
                        action
                    }
                }
            }
        }));
    };

    // Compute derived sets for the dropdown when a creator is selected
    const getSetsForSelectedCreator = (creatorId?: string) => {
        if (!creatorId) return [];
        const creator = creatorsList.find(c => c.id === creatorId);
        return creator ? creator.sets : [];
    };

    const processFinalConfirm = () => {
        // Construct new Analysis object
        const finalMatches: CreatorMatch[] = [];
        const finalResults: ScanResult[] = [];

        Object.values(decisions).forEach(d => {
            // New Match Entry
            const finalCreatorName = d.action === 'existing'
                ? creatorsList.find(c => c.id === d.targetId)?.name || d.targetName
                : d.targetName;

            const existingId = d.action === 'existing' ? d.targetId : undefined;

            // Re-map Scan Results
            // We need to find all items that belonged to this original creator
            const items = analysis.results.filter(r => r.creatorName === d.originalName);

            items.forEach(item => {
                const rootSet = item.setHierarchy && item.setHierarchy.length > 0 ? item.setHierarchy[0] : 'Unsorted';
                const setDec = d.setDecisions[rootSet];
                // Determine final set name

                let finalSetName = rootSet; // Default to current root set name
                if (setDec) {
                    if (setDec.action === 'existing' && setDec.targetId) {
                        const existingSets = getSetsForSelectedCreator(d.targetId); // Only if mapping to existing creator
                        const found = existingSets.find((s: any) => s.id === setDec.targetId);
                        if (found) finalSetName = found.name;
                    } else if (setDec.action === 'rename' || setDec.action === 'new') {
                        finalSetName = setDec.targetName;
                    }
                }

                finalResults.push({
                    creatorName: finalCreatorName,
                    setName: finalSetName,
                    setHierarchy: [finalSetName],
                    fileName: item.fileName
                });
            });

            finalMatches.push({
                foundName: finalCreatorName, // The backend uses this to lookup/create
                existingId: existingId,
                similarity: existingId ? 1 : 0,
                existingName: (d.action === 'existing' ? finalCreatorName : undefined),
                needsConfirmation: false // Approved!
            });
        });

        // Filter valid matches only
        onConfirm({
            ...analysis,
            results: finalResults,
            matches: finalMatches,
            category: category
        });
    };

    const toggleExpand = (name: string) => {
        const newSet = new Set(expandedCreators);
        if (newSet.has(name)) newSet.delete(name);
        else newSet.add(name);
        setExpandedCreators(newSet);
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="bg-bg-card border border-border-subtle rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="px-8 py-6 border-b border-border-subtle bg-white/5 shrink-0">
                    <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                        <AlertCircle className="text-brand-primary" />
                        Review Import
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Organize your content before importing.</p>
                </div>

                <div className="p-8 space-y-4 overflow-y-auto custom-scrollbar flex-grow">
                    {Object.values(decisions).map((decision) => {
                        const isExpanded = expandedCreators.has(decision.originalName);
                        // Find potential match info from original analysis for UI hints
                        const originalMatch = analysis.matches.find(m => m.foundName === decision.originalName);

                        return (
                            <div key={decision.originalName} className={`bg-white/5 border rounded-2xl transition-all ${isExpanded ? 'border-brand-primary/30 bg-white/[0.07]' : 'border-white/5 hover:bg-white/[0.08]'}`}>
                                {/* Header / Summary Row */}
                                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => toggleExpand(decision.originalName)}>
                                    <div className={`p-1 rounded-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}><ChevronRight size={20} className="text-slate-500" /></div>

                                    <div className="flex-grow grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-slate-500">Found Creator</span>
                                            <span className="font-bold text-slate-200">{decision.originalName}</span>
                                        </div>

                                        <ArrowRight size={16} className="text-slate-600" />

                                        <div className="flex items-center gap-3">
                                            {decision.action === 'new' && <span className="text-xs bg-brand-primary/20 text-brand-secondary px-2 py-1 rounded font-bold">New Creator</span>}
                                            {decision.action === 'existing' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-bold">Existing</span>}
                                            {decision.action === 'rename' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold">Rename</span>}

                                            <span className="font-bold text-white">
                                                {decision.action === 'existing'
                                                    ? (creatorsList.find(c => c.id === decision.targetId)?.name || 'Select...')
                                                    : decision.targetName}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-slate-500 text-xs font-mono whitespace-nowrap">
                                        {Object.keys(decision.setDecisions).length} Sets identified
                                    </div>
                                </div>

                                {/* Expanded Detail View */}
                                {isExpanded && (
                                    <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2">
                                        <div className="border-t border-white/5 my-4" />

                                        {/* Creator Strategy Config */}
                                        <div className="flex flex-col gap-3 mb-6 bg-black/20 p-4 rounded-xl border border-white/5">
                                            <span className="text-xs font-bold uppercase text-slate-400">Creator Action</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleCreatorActionChange(decision.originalName, 'new')}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${decision.action === 'new' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                                >
                                                    Create New
                                                </button>
                                                <button
                                                    onClick={() => handleCreatorActionChange(decision.originalName, 'existing')}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${decision.action === 'existing' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                                >
                                                    Use Existing
                                                </button>
                                                {/* Allow rename always? or just as part of 'new'? Let's keep separate rename logic or just input for new */}
                                            </div>

                                            {decision.action === 'new' && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-sm text-slate-400 whitespace-nowrap w-24">Creator Name:</span>
                                                    <input
                                                        className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full outline-none focus:border-brand-primary/50"
                                                        value={decision.targetName || ''}
                                                        onChange={(e) => setDecisions(prev => ({
                                                            ...prev,
                                                            [decision.originalName]: { ...prev[decision.originalName], targetName: e.target.value }
                                                        }))}
                                                    />
                                                </div>
                                            )}

                                            {decision.action === 'existing' && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-sm text-slate-400 whitespace-nowrap w-24">Select Creator:</span>
                                                    <select
                                                        className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full outline-none focus:border-brand-primary/50"
                                                        value={decision.targetId || ''}
                                                        onChange={(e) => handleCreatorTargetChange(decision.originalName, e.target.value)}
                                                    >
                                                        <option value="" disabled>Choose a creator...</option>
                                                        {creatorsList.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.name} {originalMatch?.similarity ? (c.id === originalMatch.existingId ? `(Recommended match: ${(originalMatch.similarity * 100).toFixed(0)}%)` : '') : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Sets Matrix */}
                                        <div className="space-y-3">
                                            <span className="text-xs font-bold uppercase text-slate-400 px-1">Sets to Import</span>
                                            {Object.values(decision.setDecisions).map((setDec, idx) => (
                                                <div key={`set-dec-${setDec.originalName}-${idx}`} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                                                    <div className="w-1/3 min-w-[200px]">
                                                        <div className="text-[10px] text-slate-500 uppercase">Found Set</div>
                                                        <div className="text-sm font-medium text-slate-200 truncate" title={setDec.originalName}>{setDec.originalName}</div>
                                                    </div>

                                                    <ArrowRight size={14} className="text-slate-600" />

                                                    <div className="flex-grow flex gap-2">
                                                        {/* If Creator is Existing, allow selecting existing sets */}
                                                        {decision.action === 'existing' && decision.targetId ? (
                                                            <select
                                                                className="bg-bg-dark border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white flex-grow outline-none focus:border-brand-primary/50"
                                                                value={setDec.action === 'existing' ? (setDec.targetId || '') : 'new'}
                                                                onChange={(e) => {
                                                                    if (e.target.value === 'new') {
                                                                        handleSetActionChange(decision.originalName, setDec.originalName, 'new');
                                                                    } else {
                                                                        const selectedSet = getSetsForSelectedCreator(decision.targetId).find((s: any) => s.id === e.target.value);
                                                                        setDecisions(prev => ({
                                                                            ...prev,
                                                                            [decision.originalName]: {
                                                                                ...prev[decision.originalName],
                                                                                setDecisions: {
                                                                                    ...prev[decision.originalName].setDecisions,
                                                                                    [setDec.originalName]: {
                                                                                        ...setDec,
                                                                                        action: 'existing',
                                                                                        targetId: e.target.value,
                                                                                        targetName: selectedSet?.name || setDec.targetName
                                                                                    }
                                                                                }
                                                                            }
                                                                        }))
                                                                    }
                                                                }}
                                                            >
                                                                <option value="new">+ Create New Set</option>
                                                                <optgroup label="Existing Sets">
                                                                    {getSetsForSelectedCreator(decision.targetId).map((s: any) => (
                                                                        <option key={`set-${s.id}`} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            </select>
                                                        ) : (
                                                            <div className="flex-grow flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-slate-500 text-xs italic">
                                                                Will create new set
                                                            </div>
                                                        )}

                                                        {/* Name Input (Visible if New or Rename is active conceptually, here just simpler logic) */}
                                                        {(setDec.action === 'new' || setDec.action === 'rename') && (
                                                            <input
                                                                className="bg-bg-dark border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white w-48 outline-none focus:border-brand-primary/50"
                                                                placeholder="Set Name"
                                                                value={setDec.targetName || ''}
                                                                onChange={(e) => setDecisions(prev => ({
                                                                    ...prev,
                                                                    [decision.originalName]: {
                                                                        ...prev[decision.originalName],
                                                                        setDecisions: {
                                                                            ...prev[decision.originalName].setDecisions,
                                                                            [setDec.originalName]: {
                                                                                ...setDec,
                                                                                targetName: e.target.value
                                                                            }
                                                                        }
                                                                    }
                                                                }))}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {analysis.duplicates && analysis.duplicates.length > 0 && (
                    <div className="border-t border-white/5 bg-black/20 shrink-0">
                        <button
                            onClick={() => setShowDuplicates(!showDuplicates)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <AlertCircle size={20} className="text-yellow-500/80" />
                                <div>
                                    <div className="font-bold text-slate-300">
                                        {analysis.duplicates.length} items ignored (already exist)
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        These files will be skipped during import.
                                    </div>
                                </div>
                            </div>
                            {showDuplicates ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                        </button>

                        {showDuplicates && (
                            <div className="max-h-48 overflow-y-auto p-2 bg-black/40 border-t border-white/5 grid gap-1">
                                {analysis.duplicates.map((dup, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded hover:bg-white/5 transition-colors">
                                        <div className="text-slate-400 truncate w-1/3" title={dup.fileName}>
                                            {dup.fileName}
                                        </div>
                                        <ArrowRight size={10} className="text-slate-600 shrink-0" />
                                        <div className="text-brand-primary truncate w-2/3" title={`${dup.existingCreatorName} > ${dup.existingSetHierarchy.join(' > ')}`}>
                                            {dup.existingCreatorName} <span className="text-slate-600">/</span> {dup.existingSetHierarchy.join(' / ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="px-8 py-6 border-t border-border-subtle bg-white/5 shrink-0 flex items-center justify-between gap-8">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Save results to:</span>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setCategory('buildings')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${category === 'buildings' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Package size={14} />
                                Buildings
                            </button>
                            <button
                                onClick={() => setCategory('uploads')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${category === 'uploads' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Upload size={14} />
                                Uploads
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 flex-grow justify-end">
                        <button
                            onClick={onCancel}
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-slate-400 transition-all border border-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={processFinalConfirm}
                            className="px-12 py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-primary/20 transition-all active:scale-[0.98]"
                        >
                            Import results
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScanConfirmationModal;
