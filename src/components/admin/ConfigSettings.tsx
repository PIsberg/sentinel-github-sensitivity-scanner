"use client";

import React, { useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { Key, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ConfigSettings() {
    const { githubToken, setGithubToken } = useConfig();
    const [tokenInput, setTokenInput] = useState(githubToken);
    const [showToken, setShowToken] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setGithubToken(tokenInput);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Key size={20} className="text-blue-500" />
                    GitHub Configuration
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Provide a Personal Access Token to increase API rate limits (from 60 to 5,000 requests/hour).
                </p>
            </div>

            <div className="p-6">
                <form onSubmit={handleSave} className="max-w-xl">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Personal Access Token
                    </label>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type={showToken ? "text" : "password"}
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                placeholder="ghp_..."
                                className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                            disabled={tokenInput === githubToken && !saved}
                        >
                            {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                            {saved ? 'Saved' : 'Save'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Token is stored locally in your browser. Needs <code>repo</code> or <code>public_repo</code> scope.
                    </p>
                </form>
            </div>
        </div>
    );
}
