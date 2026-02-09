import React, { useState, useEffect } from 'react';

interface CCItem {
    creatorName: string;
    setName: string;
    fileName: string;
}

const App: React.FC = () => {
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<CCItem[]>([]);
    const [credits, setCredits] = useState<any[]>([]);

    const loadCredits = async () => {
        const data = await (window as any).electron.invoke('get-credits');
        setCredits(data);
    };

    useEffect(() => {
        loadCredits();
    }, []);

    const handleScan = async () => {
        setScanning(true);
        try {
            const data = await (window as any).electron.invoke('scan-zip');
            if (data) {
                setResults(data);
                loadCredits();
            }
        } catch (error) {
            console.error('Scan failed:', error);
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col p-8">
            <header className="mb-12 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-purple-400">Sims 4 CC Credit Generator</h1>
                    <p className="text-gray-400 mt-2">Manage and credit your custom content with ease.</p>
                </div>
                <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                    {scanning ? 'Scanning...' : 'Select ZIP to Scan'}
                </button>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Database Credits List */}
                <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                        Stored Credits Library
                    </h2>

                    {credits.length === 0 ? (
                        <p className="text-gray-500 italic text-center py-12">No creators found. Scan a ZIP to start!</p>
                    ) : (
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                            {credits.map((creator) => (
                                <div key={creator.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                                    <h3 className="text-xl font-bold text-gray-200 mb-2">{creator.name}</h3>
                                    <div className="space-y-3">
                                        {creator.sets.map((set: any) => (
                                            <div key={set.id} className="pl-4 border-l-2 border-purple-900">
                                                <h4 className="text-purple-300 font-medium">{set.name}</h4>
                                                <ul className="text-sm text-gray-500 mt-1">
                                                    {set.items.map((item: any) => (
                                                        <li key={item.id}>• {item.file_name}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Last Scan Status */}
                <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-2 h-8 bg-green-500 rounded-full"></span>
                        Last Scan Activity
                    </h2>

                    {results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-600 border-2 border-dashed border-gray-700 rounded-lg">
                            <span className="text-lg">Waiting for scan...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-green-900/20 text-green-400 p-3 rounded-lg border border-green-900/50 mb-4">
                                Successfully identified {results.length} items.
                            </div>
                            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                {results.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-900 p-3 rounded border border-gray-800">
                                        <span className="text-gray-300 font-medium">{item.fileName}</span>
                                        <span className="text-purple-400 bg-purple-900/30 px-2 py-1 rounded text-xs">{item.creatorName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default App;
