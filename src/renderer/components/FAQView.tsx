import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, BookOpen, Settings, Zap, MessageCircle, AlertCircle, FileSearch, Clipboard, Twitter, Heart } from 'lucide-react';

interface FAQItemProps {
    question: string;
    answer: React.ReactNode;
    icon?: React.ReactNode;
    isOpenByDefault?: boolean;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, icon, isOpenByDefault = false }) => {
    const [isOpen, setIsOpen] = useState(isOpenByDefault);

    return (
        <div className={`border border-white/5 rounded-2xl overflow-hidden transition-all ${isOpen ? 'bg-white/[0.07] border-brand-primary/30 shadow-lg shadow-brand-primary/5' : 'bg-white/[0.03] hover:bg-white/[0.05]'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 text-left transition-colors"
            >
                <div className="flex items-center gap-4">
                    {icon && <div className="text-brand-primary/70">{icon}</div>}
                    <span className="font-bold text-slate-100">{question}</span>
                </div>
                {isOpen ? <ChevronDown size={20} className="text-brand-primary" /> : <ChevronRight size={20} className="text-slate-500" />}
            </button>

            {isOpen && (
                <div className="px-5 pb-5 pt-0 text-slate-400 text-sm leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="border-t border-white/5 pt-4">
                        {answer}
                    </div>
                </div>
            )}
        </div>
    );
};

const FAQView: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col gap-2 mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3 bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                    <HelpCircle className="text-brand-primary/80" />
                    Help & FAQ
                </h2>
                <p className="text-slate-500 font-medium">Everything you need to know about CC Catalog.</p>
            </div>

            <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 px-1 mb-6">General Information</h3>

                <FAQItem
                    question="What is CC Catalog?"
                    isOpenByDefault={true}
                    icon={<BookOpen size={20} />}
                    answer={
                        <div className="space-y-3">
                            <p>
                                CC Catalog is a specialized tool designed for <span className="text-brand-secondary font-bold">The Sims 4</span> creators and players who want to organize their Custom Content (CC) library effectively.
                            </p>
                            <p>
                                It scans your zip files, identifies creators and sets, and allows you to generate beautifully formatted reports for platforms like Patreon, WhatsApp, or personal documentation.
                            </p>
                        </div>
                    }
                />

                <FAQItem
                    question="How it works?"
                    icon={<Zap size={20} />}
                    answer={
                        <div className="space-y-3">
                            <p>
                                The app uses an intelligent <span className="text-slate-200 font-bold">Zip Scanner</span> that analyzes the folder structure and file names within your compressed files.
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-slate-300">
                                <li><strong>Creators:</strong> Identified by top-level folder names or specific patterns.</li>
                                <li><strong>Sets:</strong> Mapped based on the internal hierarchy of your zips.</li>
                                <li><strong>Matching:</strong> The app compares found names with your existing database to prevent duplicates and maintain consistency.</li>
                            </ul>
                        </div>
                    }
                />
            </section>

            <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 px-1 mb-6">How to Use</h3>

                <FAQItem
                    question="Scanning and Importing CC"
                    icon={<FileSearch size={20} />}
                    answer={
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/20 text-brand-primary flex items-center justify-center font-black shrink-0">1</div>
                                <p>Go to the <span className="text-slate-200 font-medium">Dashboard</span> and drag a <strong>.zip</strong> file into the upload area.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/20 text-brand-primary flex items-center justify-center font-black shrink-0">2</div>
                                <p>Wait for the analysis. Review the <strong>Import Modal</strong> to confirm if creators/sets should be created as new or mapped to existing ones.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/20 text-brand-primary flex items-center justify-center font-black shrink-0">3</div>
                                <p>Choose a category: <span className="text-brand-secondary">Buildings</span> for projects or <span className="text-slate-400">Uploads</span> for utility scans.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/20 text-brand-primary flex items-center justify-center font-black shrink-0">4</div>
                                <p>Click <strong>Import Results</strong> to finalize the process.</p>
                            </div>
                        </div>
                    }
                />

                <FAQItem
                    question="Generating Reports"
                    icon={<Clipboard size={20} />}
                    answer={
                        <div className="space-y-3">
                            <p>You can generate reports from two places:</p>
                            <ul className="list-disc pl-5 space-y-2 text-slate-300">
                                <li><strong>Dashboard:</strong> After a scan, use the "Copy Markdown" or "Copy HTML" buttons.</li>
                                <li><strong>History:</strong> Use the report icon next to any previous scan log to regenerate its report.</li>
                            </ul>
                            <p className="bg-brand-primary/10 p-3 rounded-lg text-xs border border-brand-primary/20">
                                <strong>Tip:</strong> HTML reports are perfect for Patreon posts as they preserve links and list formatting!
                            </p>
                        </div>
                    }
                />
            </section>

            <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 px-1 mb-6">Support & Issues</h3>

                <FAQItem
                    question="Application Crashes or Errors"
                    icon={<AlertCircle size={20} />}
                    answer={
                        <div className="space-y-3">
                            <p>If the app encounters a critical error, an <span className="text-red-400 font-bold">Error Boundary</span> will appear.</p>
                            <p>Please use the <strong>"Save Crash Report"</strong> button to save a log file to your desktop and send it to the developer for a quick fix.</p>
                        </div>
                    }
                />

                <FAQItem
                    question="Contact and Feedback"
                    icon={<MessageCircle size={20} />}
                    answer={
                        <div className="space-y-4">
                            <p>Have suggestions or found a bug? Join our community or follow the creator for updates!</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <a
                                    href="https://discord.gg/vsZQYxGb"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-3 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl hover:bg-[#5865F2]/20 transition-all group"
                                >
                                    <div className="w-8 h-8 bg-[#5865F2] rounded-lg flex items-center justify-center text-white">
                                        <MessageCircle size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-100">The Cozy Sim Corner</span>
                                        <span className="text-[10px] text-slate-500 uppercase font-black">Join Discord</span>
                                    </div>
                                </a>

                                <a
                                    href="https://x.com/violetsimmer7"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                                >
                                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white border border-white/10">
                                        <Twitter size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-100">@violetsimmer7</span>
                                        <span className="text-[10px] text-slate-500 uppercase font-black">Follow on X</span>
                                    </div>
                                </a>
                            </div>

                            <div className="border-t border-white/5 pt-4">
                                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Support the Creator</p>
                                <a
                                    href="https://www.patreon.com/cw/Violetsimmer7"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl hover:bg-brand-primary/20 transition-all group"
                                >
                                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                                        <Heart size={20} fill="white" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-100 italic">Patreon: Violetsimmer7</span>
                                        <span className="text-[10px] text-brand-secondary font-bold uppercase tracking-widest">Help the project grow!</span>
                                    </div>
                                </a>
                            </div>
                        </div>
                    }
                />
            </section>

            <div className="pt-10 text-center border-t border-white/5">
                <p className="text-slate-600 text-[10px] uppercase font-bold tracking-[0.3em]">CC Catalog v1.0.16</p>
            </div>
        </div>
    );
};

export default FAQView;
