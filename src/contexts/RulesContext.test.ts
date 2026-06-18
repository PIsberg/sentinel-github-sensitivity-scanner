import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES } from './RulesContext';
import { buildRegex } from '@/lib/scanner';

describe('DEFAULT_RULES', () => {
  it('every pattern compiles to a valid RegExp (engine swallows invalid ones silently)', () => {
    for (const rule of DEFAULT_RULES) {
      expect(() => buildRegex(rule.pattern, 'g'), rule.name).not.toThrow();
    }
  });

  it('has unique ids and non-empty names/patterns', () => {
    const ids = DEFAULT_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of DEFAULT_RULES) {
      expect(rule.name.length, rule.id).toBeGreaterThan(0);
      expect(rule.pattern.length, rule.name).toBeGreaterThan(0);
    }
  });

  it('uses only valid severity levels', () => {
    for (const rule of DEFAULT_RULES) {
      expect(['low', 'medium', 'high'], rule.name).toContain(rule.severity);
    }
  });
});
