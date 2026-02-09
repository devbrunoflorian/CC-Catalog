import React from 'react';
import { X, Check } from 'lucide-react';
import { ThemeColor, useTheme } from '../context/ThemeContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { themeColor, setThemeColor, opacity, setOpacity } = useTheme();

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
            <div className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                        Appearance
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Theme Color */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium text-slate-300 uppercase tracking-wider block">Accent Tint</label>
                        <div className="grid grid-cols-2 gap-4">
                            {colors.map((color) => (
                                <button
                                    key={color.id}
                                    onClick={() => setThemeColor(color.id)}
                                    className={`relative p-4 rounded-xl border transition-all flex items-center justify-between group ${themeColor === color.id
                                        ? 'border-brand-primary bg-brand-primary/10'
                                        : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'
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
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 px-4 text-sm font-medium text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <span>Export CSV</span>
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will update your library structure based on the CSV. Continue?')) return;
                                    const res = await (window as any).electron.invoke('import-csv');
                                    if (res.success) alert(`Library updated! ${res.count} lines processed.`);
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 px-4 text-sm font-medium text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <span>Import CSV</span>
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Export your library to edit organization in Excel, then import it back.
                            Format: Creator, P/W, Set, P/W, Items.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
