"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ConfigContextType {
    githubToken: string;
    setGithubToken: (token: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const [githubToken, setGithubTokenState] = useState<string>("");
    const [loaded, setLoaded] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('scanner_config_token');
        if (saved) {
            setGithubTokenState(saved);
        }
        setLoaded(true);
    }, []);

    // Save to local storage whenever token changes
    const setGithubToken = (token: string) => {
        setGithubTokenState(token);
        localStorage.setItem('scanner_config_token', token);
    };

    return (
        <ConfigContext.Provider
            value={{ githubToken, setGithubToken }}
        >
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}
