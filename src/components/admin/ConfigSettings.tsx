"use client";

import React, { useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { Key, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface ProviderSectionProps {
  title: string;
  description: string;
  placeholder: string;
  note: React.ReactNode;
  value: string;
  onSave: (value: string) => void;
  extraField?: React.ReactNode;
}

function ProviderSection({ title, description, placeholder, note, value, onSave, extraField }: ProviderSectionProps) {
  const [input, setInput] = useState(value);
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(input);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {extraField}
      <form onSubmit={handleSave} className="max-w-xl">
        <label className="block text-sm font-medium text-gray-700 mb-2">Access Token</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type={showToken ? 'text' : 'password'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
          >
            {saved ? <CheckCircle size={18} /> : <Save size={18} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{note}</p>
      </form>
    </div>
  );
}

export default function ConfigSettings() {
  const { tokens, setToken, giteaBaseUrl, setGiteaBaseUrl } = useConfig();
  const [giteaUrlInput, setGiteaUrlInput] = useState(giteaBaseUrl);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Key size={20} className="text-blue-500" />
          Provider Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Add access tokens to increase API rate limits and enable scanning of private repositories. Tokens are stored locally in your browser.
        </p>
      </div>

      <ProviderSection
        title="GitHub"
        description="github.com — unauthenticated: 60 req/hr, authenticated: 5,000 req/hr."
        placeholder="ghp_..."
        note={<>Classic PAT (<code>ghp_</code>) or fine-grained (<code>github_pat_</code>). Needs <code>repo</code> or <code>public_repo</code> scope.</>}
        value={tokens.github}
        onSave={(v) => setToken('github', v)}
      />

      <ProviderSection
        title="GitLab"
        description="gitlab.com and self-hosted GitLab instances."
        placeholder="glpat-..."
        note={<>Personal Access Token with <code>read_api</code> scope.</>}
        value={tokens.gitlab}
        onSave={(v) => setToken('gitlab', v)}
      />

      <ProviderSection
        title="Bitbucket"
        description="bitbucket.org — enter credentials as username:app_password."
        placeholder="myusername:myapppassword"
        note={<>Create an App Password in Bitbucket under <em>Settings &rsaquo; App passwords</em> with <code>Repositories: Read</code> permission.</>}
        value={tokens.bitbucket}
        onSave={(v) => setToken('bitbucket', v)}
      />

      <ProviderSection
        title="Gitea / Self-hosted"
        description="Any self-hosted Gitea instance. Full URLs (https://gitea.example.com/user/repo) are detected automatically."
        placeholder="your-token-here"
        note="Generated in Gitea under Settings → Applications."
        value={tokens.gitea}
        onSave={(v) => setToken('gitea', v)}
        extraField={
          <div className="max-w-xl mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Instance URL</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={giteaUrlInput}
                onChange={(e) => setGiteaUrlInput(e.target.value)}
                placeholder="https://gitea.example.com"
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setGiteaBaseUrl(giteaUrlInput)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium transition"
              >
                Save URL
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Optional — only needed when entering shorthand &ldquo;owner/repo&rdquo; without a hostname.</p>
          </div>
        }
      />
    </div>
  );
}
