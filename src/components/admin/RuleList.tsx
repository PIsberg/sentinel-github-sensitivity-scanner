"use client";

import React, { useState } from "react";
import { useRules } from "@/contexts/RulesContext";
import { Rule } from "@/types";
import { Edit2, Trash2, Plus, AlertTriangle, Shield, CheckCircle } from "lucide-react";
import RuleEditor from "./RuleEditor";

const SeverityBadge = ({ severity }: { severity: string }) => {
    const colors = {
        high: "bg-red-100 text-red-700 border-red-200",
        medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
        low: "bg-blue-100 text-blue-700 border-blue-200",
    };

    const icons = {
        high: <AlertTriangle size={14} />,
        medium: <Shield size={14} />,
        low: <CheckCircle size={14} />
    }

    const key = severity as keyof typeof colors;

    return (
        <span
            className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 w-fit ${colors[key]}`}
        >
            {icons[key]} {severity.toUpperCase()}
        </span>
    );
};

export default function RuleList() {
    const { rules, addRule, updateRule, deleteRule, importRules } = useRules();
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Import Handler
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loaded = JSON.parse(event.target?.result as string);
                if (Array.isArray(loaded)) {
                    // Basic validation: ensure items look like rules
                    // In a real app, use Zod or similar
                    importRules(loaded);
                    alert(`Successfully imported ${loaded.length} rules.`);
                }
            } catch (err) {
                console.error("Import failed", err);
                alert("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    };

    // Export Handler
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scanner-rules-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Scanning Rules</h2>
                    <p className="text-sm text-gray-500">Configure what the scanner looks for.</p>
                </div>
                <div className="flex gap-2">
                    <label className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition">
                        Import
                        <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                    </label>
                    <button onClick={handleExport} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                        Export
                    </button>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                    >
                        <Plus size={16} />
                        Add Rule
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pattern</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rules.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    No rules defined. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            rules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{rule.name}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{rule.description}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700 border border-gray-200">
                                            {rule.pattern}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4">
                                        <SeverityBadge severity={rule.severity} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingRule(rule)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteRule(rule.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {(editingRule || isCreating) && (
                <RuleEditor
                    initialRule={editingRule || undefined}
                    onSave={(ruleData) => {
                        if (editingRule) {
                            updateRule(editingRule.id, ruleData);
                        } else {
                            addRule(ruleData);
                        }
                        setEditingRule(null);
                        setIsCreating(false);
                    }}
                    onCancel={() => {
                        setEditingRule(null);
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
}
