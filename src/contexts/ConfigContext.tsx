"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ProviderTokens } from '@/types';

const EMPTY_TOKENS: ProviderTokens = { github: '', gitlab: '', bitbucket: '', gitea: '' };

interface ConfigContextType {
  tokens: ProviderTokens;
  setToken: (provider: keyof ProviderTokens, value: string) => void;
  giteaBaseUrl: string;
  setGiteaBaseUrl: (url: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokensState] = useState<ProviderTokens>(EMPTY_TOKENS);
  const [giteaBaseUrl, setGiteaBaseUrlState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Migrate legacy single-token key
    const legacy = localStorage.getItem('scanner_config_token');
    const saved = localStorage.getItem('scanner_tokens');
    const parsed: ProviderTokens = saved
      ? { ...EMPTY_TOKENS, ...JSON.parse(saved) }
      : { ...EMPTY_TOKENS };
    if (legacy && !parsed.github) {
      parsed.github = legacy;
      localStorage.removeItem('scanner_config_token');
    }
    setTokensState(parsed);

    const savedBase = localStorage.getItem('scanner_gitea_base_url');
    if (savedBase) setGiteaBaseUrlState(savedBase);
    setLoaded(true);
  }, []);

  const setToken = (provider: keyof ProviderTokens, value: string) => {
    setTokensState(prev => {
      const next = { ...prev, [provider]: value };
      localStorage.setItem('scanner_tokens', JSON.stringify(next));
      return next;
    });
  };

  const setGiteaBaseUrl = (url: string) => {
    setGiteaBaseUrlState(url);
    localStorage.setItem('scanner_gitea_base_url', url);
  };

  if (!loaded) return null;

  return (
    <ConfigContext.Provider value={{ tokens, setToken, giteaBaseUrl, setGiteaBaseUrl }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
}
