"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Rule } from '@/types';

// Default rules to seed if storage is empty
const DEFAULT_RULES: Rule[] = [
    // Cloud infrastructure
    {
        id: '1',
        name: 'AWS Access Key ID',
        pattern: 'AKIA[0-9A-Z]{16}',
        severity: 'high',
        description: 'Detects AWS Access Key IDs (AKIA prefix)',
    },
    {
        id: '2',
        name: 'Private Key',
        pattern: '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
        severity: 'high',
        description: 'Detects PEM-encoded private keys (RSA, EC, DSA, OpenSSH)',
    },
    {
        id: '3',
        name: 'Google API Key',
        pattern: 'AIza[0-9A-Za-z\\-_]{35}',
        severity: 'high',
        description: 'Detects Google API Keys',
    },
    // AI services
    {
        id: '4',
        name: 'OpenAI API Key',
        pattern: 'sk-[a-zA-Z0-9]{48}',
        severity: 'high',
        description: 'Detects OpenAI API keys (classic sk- format)',
    },
    {
        id: '5',
        name: 'OpenAI API Key (project)',
        pattern: 'sk-proj-[a-zA-Z0-9_-]{40,}',
        severity: 'high',
        description: 'Detects OpenAI project-scoped API keys',
    },
    {
        id: '6',
        name: 'Anthropic API Key',
        pattern: 'sk-ant-[a-zA-Z0-9_-]{90,}',
        severity: 'high',
        description: 'Detects Anthropic Claude API keys',
    },
    {
        id: '7',
        name: 'Hugging Face Token',
        pattern: 'hf_[a-zA-Z0-9]{34}',
        severity: 'high',
        description: 'Detects Hugging Face Hub access tokens',
    },
    {
        id: '8',
        name: 'Replicate API Key',
        pattern: 'r8_[a-zA-Z0-9]{40}',
        severity: 'high',
        description: 'Detects Replicate API keys',
    },
    // Version control
    {
        id: '9',
        name: 'GitHub PAT',
        pattern: 'gh[posrt]_[a-zA-Z0-9]{36}',
        severity: 'high',
        description: 'Detects GitHub Personal Access Tokens (ghp_, gho_, ghs_, ghr_ prefixes)',
    },
    {
        id: '10',
        name: 'GitHub Fine-grained PAT',
        pattern: 'github_pat_[a-zA-Z0-9_]{82}',
        severity: 'high',
        description: 'Detects GitHub fine-grained Personal Access Tokens',
    },
    {
        id: '11',
        name: 'GitLab PAT',
        pattern: 'glpat-[a-zA-Z0-9_-]{20}',
        severity: 'high',
        description: 'Detects GitLab Personal Access Tokens',
    },
    // Payment & communication
    {
        id: '12',
        name: 'Stripe Secret Key',
        pattern: 'sk_(?:live|test)_[0-9a-zA-Z]{24,}',
        severity: 'high',
        description: 'Detects Stripe secret API keys (live and test)',
    },
    {
        id: '13',
        name: 'Slack Token',
        pattern: 'xox[baprs]-[0-9a-zA-Z-]{20,}',
        severity: 'high',
        description: 'Detects Slack bot, app, user, and legacy tokens',
    },
    {
        id: '14',
        name: 'SendGrid API Key',
        pattern: 'SG\\.[a-zA-Z0-9_-]{22}\\.[a-zA-Z0-9_-]{43}',
        severity: 'high',
        description: 'Detects SendGrid API keys',
    },
    // Package registries & general
    {
        id: '15',
        name: 'npm Access Token',
        pattern: 'npm_[a-zA-Z0-9]{36}',
        severity: 'medium',
        description: 'Detects npm access tokens',
    },
    {
        id: '16',
        name: 'Generic Password',
        pattern: '(?:password|passwd|pwd|pass)\\s*[=:]\\s*[\'"]?[a-zA-Z0-9@#$%^&*]{8,}[\'"]?',
        severity: 'medium',
        description: 'Detects password assignments (password/passwd/pwd/pass with = or : separator)',
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
