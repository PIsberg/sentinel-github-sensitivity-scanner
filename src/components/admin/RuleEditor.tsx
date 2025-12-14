"use client";

import React, { useState, useEffect } from "react";
import { Rule, Severity } from "@/types";
import { X } from "lucide-react";

interface RuleEditorProps {
    initialRule?: Rule;
    onSave: (rule: Omit<Rule, "id">) => void;
    onCancel: () => void;
}

export default function RuleEditor({ initialRule, onSave, onCancel }: RuleEditorProps) {
    const [formData, setFormData] = useState<Omit<Rule, "id">>({
        name: "",
        pattern: "",
        severity: "medium",
        description: "",
    });

    useEffect(() => {
        if (initialRule) {
            setFormData({
                name: initialRule.name,
                pattern: initialRule.pattern,
                severity: initialRule.severity,
                description: initialRule.description,
            });
        }
    }, [initialRule]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {initialRule ? "Edit Rule" : "Add New Rule"}
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rule Name
                        </label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            placeholder="e.g. AWS Access Key"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Regex Pattern
                        </label>
                        <input
                            required
                            type="text"
                            value={formData.pattern}
                            onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            placeholder="e.g. AKIA[0-9A-Z]{16}"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use standard JavaScript RegExp syntax.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Severity
                        </label>
                        <select
                            value={formData.severity}
                            onChange={(e) => setFormData({ ...formData, severity: e.target.value as Severity })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition min-h-[80px]"
                            placeholder="What does this rule detect?"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition shadow-sm"
                        >
                            Save Rule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
