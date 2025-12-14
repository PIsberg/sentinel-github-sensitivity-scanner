"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Rule } from '@/types';

// Default rules to seed if storage is empty
const DEFAULT_RULES: Rule[] = [
    {
        id: '1',
        name: 'AWS Access Key',
        pattern: 'AKIA[0-9A-Z]{16}',
        severity: 'high',
        description: 'Detects AWS Access Key IDs',
    },
    {
        id: '2',
        name: 'Private Key',
        pattern: '-----BEGIN PRIVATE KEY-----',
        severity: 'high',
        description: 'Detects generic private keys',
    },
    {
        id: '3',
        name: 'Generic Password',
        pattern: 'password\\s*=\\s*[\'"][a-zA-Z0-9@#$%^&*]{8,}[\'"]',
        severity: 'medium',
        description: 'Detects simple password assignments (heuristic)',
    },
    {
        id: '4',
        name: 'Google API Key',
        pattern: 'AIza[0-9A-Za-z\\-_]{35}',
        severity: 'high',
        description: 'Detects Google API Keys',
    },
];

interface RulesContextType {
    rules: Rule[];
    addRule: (rule: Omit<Rule, 'id'>) => void;
    updateRule: (id: string, rule: Partial<Rule>) => void;
    deleteRule: (id: string) => void;
    resetRules: () => void;
    importRules: (newRules: Rule[]) => void;
}

const RulesContext = createContext<RulesContextType | undefined>(undefined);

export function RulesProvider({ children }: { children: React.ReactNode }) {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('scanner_rules');
        if (saved) {
            try {
                setRules(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse rules, using defaults', e);
                setRules(DEFAULT_RULES);
            }
        } else {
            setRules(DEFAULT_RULES);
        }
        setLoaded(true);
    }, []);

    // Save to local storage whenever rules change
    useEffect(() => {
        if (loaded) {
            localStorage.setItem('scanner_rules', JSON.stringify(rules));
        }
    }, [rules, loaded]);

    const addRule = (rule: Omit<Rule, 'id'>) => {
        const newRule: Rule = {
            ...rule,
            id: crypto.randomUUID(),
        };
        setRules((prev) => [...prev, newRule]);
    };

    const updateRule = (id: string, updates: Partial<Rule>) => {
        setRules((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
        );
    };

    const deleteRule = (id: string) => {
        setRules((prev) => prev.filter((r) => r.id !== id));
    };

    const resetRules = () => {
        setRules(DEFAULT_RULES);
    };

    const importRules = (newRules: Rule[]) => {
        // Basic validation could go here
        setRules(newRules);
    }

    return (
        <RulesContext.Provider
            value={{ rules, addRule, updateRule, deleteRule, resetRules, importRules }}
        >
            {children}
        </RulesContext.Provider>
    );
}

export function useRules() {
    const context = useContext(RulesContext);
    if (!context) {
        throw new Error('useRules must be used within a RulesProvider');
    }
    return context;
}
