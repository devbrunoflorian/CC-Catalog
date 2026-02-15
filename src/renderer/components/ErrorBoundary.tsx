import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw, Download, Terminal } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    saveStatus: 'idle' | 'saving' | 'success' | 'error';
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        saveStatus: 'idle'
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null, saveStatus: 'idle' };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });

        // Log to main process
        (window as any).electron.invoke('report-renderer-error', {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null, saveStatus: 'idle' });
        window.location.reload();
    };

    private handleSaveLog = async () => {
        this.setState({ saveStatus: 'saving' });
        try {
            const result = await (window as any).electron.invoke('save-crash-report-file');
            if (result.success) {
                this.setState({ saveStatus: 'success' });
                setTimeout(() => this.setState({ saveStatus: 'idle' }), 3000);
            } else {
                this.setState({ saveStatus: 'error' });
            }
        } catch (err) {
            this.setState({ saveStatus: 'error' });
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 overflow-auto">
                    {/* Backdrop Glow */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full" />
                    </div>

                    <div className="relative w-full max-w-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                                <AlertTriangle size={40} className="text-red-500" />
                            </div>

                            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Opa! Algo deu errado.</h1>
                            <p className="text-slate-400 mb-8 max-w-md">
                                O aplicativo encontrou um erro inesperado e precisou ser interrompido para evitar perda de dados.
                            </p>

                            <div className="w-full bg-black/40 rounded-xl border border-white/5 p-4 mb-8 text-left group">
                                <div className="flex items-center gap-2 text-red-400 mb-2 font-mono text-xs font-bold uppercase tracking-wider">
                                    <Terminal size={14} />
                                    <span>Detalhes do Erro</span>
                                </div>
                                <div className="font-mono text-sm text-slate-300 break-all overflow-auto max-h-[150px] custom-scrollbar selection:bg-red-500/30">
                                    {this.state.error?.toString()}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                <button
                                    onClick={this.handleReset}
                                    className="flex items-center justify-center gap-2 bg-white text-slate-950 px-6 py-3.5 rounded-xl font-semibold hover:bg-slate-200 transition-all active:scale-95 shadow-lg shadow-white/5"
                                >
                                    <RotateCcw size={18} />
                                    Reiniciar Aplicativo
                                </button>

                                <button
                                    onClick={this.handleSaveLog}
                                    disabled={this.state.saveStatus === 'saving'}
                                    className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold border transition-all active:scale-95 shadow-lg ${this.state.saveStatus === 'success'
                                            ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                            : this.state.saveStatus === 'error'
                                                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {this.state.saveStatus === 'saving' ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : this.state.saveStatus === 'success' ? (
                                        <>
                                            <Download size={18} />
                                            Log Salvo!
                                        </>
                                    ) : (
                                        <>
                                            <Download size={18} />
                                            Salvar Crash Report
                                        </>
                                    )}
                                </button>
                            </div>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="mt-8 text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 transition-colors"
                            >
                                <Home size={14} />
                                Voltar ao Início
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
