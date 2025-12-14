"use client";

import React, { useState } from "react";
import { useScanner } from "@/hooks/useScanner";
import { useRules } from "@/contexts/RulesContext";
import { Search, Loader2, AlertTriangle, FileText, Github, CheckCircle, XCircle } from "lucide-react";

export default function Scanner() {
    const { rules } = useRules();
    const { progress, results, error, startScan, stopScan } = useScanner(rules);
    const [target, setTarget] = useState("");

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (target.trim()) {
            startScan(target);
        }
    };

    const getStatusColor = () => {
        switch (progress.status) {
            case 'error': return 'bg-red-50 text-red-700 border-red-200';
            case 'complete': return 'bg-green-50 text-green-700 border-green-200';
            default: return 'bg-blue-50 text-blue-700 border-blue-200';
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Input Section */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
                <div className="p-8 text-center bg-gradient-to-b from-blue-50 to-white">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Scan for Sensitive Data</h1>
                    <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                        Enter a GitHub URL (user or repository) to scan for secrets, private keys, and credentials matching your configured rules.
                    </p>

                    <form onSubmit={handleScan} className="max-w-2xl mx-auto flex gap-3">
                        <div className="relative flex-1">
                            <Github className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                placeholder="https://github.com/username or https://github.com/username/repo"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-base text-gray-900 font-medium"
                                disabled={progress.status === 'scanning' || progress.status === 'fetching_repos' || progress.status === 'downloading'}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={progress.status === 'scanning' || progress.status === 'fetching_repos' || progress.status === 'downloading' || !target}
                            className={`px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold transition flex items-center gap-2 ${progress.status === 'scanning' || progress.status === 'fetching_repos' || progress.status === 'downloading' ? 'hidden' : ''}`}
                        >
                            Scan Now
                        </button>

                        {(progress.status === 'scanning' || progress.status === 'fetching_repos' || progress.status === 'downloading') && (
                            <button
                                type="button"
                                onClick={stopScan}
                                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition flex items-center gap-2"
                            >
                                <XCircle size={20} /> Stop
                            </button>
                        )}
                    </form>
                </div>

                {/* Status / Error Message */}
                {error && (
                    <div className="p-4 bg-red-50 border-t border-red-100 flex items-center gap-3 text-red-700">
                        <XCircle size={20} />
                        <span className="font-medium">{error}</span>
                    </div>
                )}
            </div>

            {/* Progress Section */}
            {(progress.status === 'scanning' || progress.status === 'fetching_repos' || progress.status === 'downloading') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-semibold text-gray-900">
                                {progress.status === 'downloading' ? 'Downloading repository...' : 'Scanning in progress...'}
                            </h3>
                            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                {progress.status === 'fetching_repos' ? 'Fetching repositories...' :
                                    progress.status === 'downloading' ? 'Downloading archive (this is fast)...' : (
                                        <>
                                            <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{progress.currentFile || 'Initializing...'}</span>
                                        </>
                                    )}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">{progress.filesScanned}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Files Scanned</div>
                        </div>
                    </div>

                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300 relative overflow-hidden"
                            style={{ width: '100%' }} // Infinite loading bar for now as we don't assume total
                        >
                            <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        Scanning {progress.currentRepo ? `repository: ${progress.currentRepo}` : 'targets...'}
                    </p>
                </div>
            )}

            {/* Results Section */}
            {progress.status === 'complete' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-gray-900">Scan Results</h2>
                        <div className="flex gap-4 items-center">
                            <div className="hidden md:flex gap-4 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
                                <div>
                                    <span className="font-semibold text-gray-900">{progress.reposScanned}</span> Repos
                                </div>
                                <div className="w-px bg-gray-200"></div>
                                <div>
                                    <span className="font-semibold text-gray-900">{progress.filesScanned}</span> Files
                                </div>
                                <div className="w-px bg-gray-200"></div>
                                <div>
                                    <span className="font-semibold text-gray-900">{(progress.bytesScanned / 1024).toFixed(1)}</span> KB
                                </div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-sm font-medium border flex items-center gap-2 ${results.length > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                {results.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                                {results.length} Issue{results.length !== 1 && 's'} Found
                            </span>
                        </div>
                    </div>

                    {results.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Clean Scan!</h3>
                            <p className="text-gray-500">No sensitive data found matching your current rules.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="divide-y divide-gray-100">
                                {results.map((result, idx) => (
                                    <div key={idx} className="p-6 hover:bg-gray-50 transition group">
                                        <div className="flex justify-between items-start gap-4 mb-2">
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Github size={14} />
                                                <span className="font-medium text-gray-900">{result.repo}</span>
                                                <span>/</span>
                                                <FileText size={14} />
                                                <span className="font-medium text-gray-900">{result.file}</span>
                                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">Line {result.line}</span>
                                            </div>
                                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase tracking-wider">
                                                {result.ruleId}
                                            </span>
                                        </div>

                                        <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-gray-300 overflow-x-auto relative group-hover:shadow-lg transition-shadow">
                                            <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-500 bg-gray-800 rounded-bl-lg">Match</div>
                                            {result.match}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
