import { describe, expect, it } from 'vitest';
import { validateAlias, validateBaseUrl } from '../src/util/validate.js';

describe('validateAlias', () => {
  it('accepts simple names', () => {
    expect(validateAlias('cx')).toBeNull();
    expect(validateAlias('codex-glm')).toBeNull();
    expect(validateAlias('codex_o')).toBeNull();
  });
  it('rejects empty, spaces, and shell metacharacters', () => {
    expect(validateAlias('')).toMatch(/empty/);
    expect(validateAlias('a b')).toMatch(/letters/);
    expect(validateAlias('a/b')).toMatch(/letters/);
    expect(validateAlias('$x')).toMatch(/letters/);
  });
  it('rejects reserved command names', () => {
    expect(validateAlias('cd')).toMatch(/reserved/);
    expect(validateAlias('codex')).toMatch(/reserved/);
  });
});

describe('validateBaseUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(validateBaseUrl('https://api.example.com/v1')).toBeNull();
  });
  it('rejects empty and non-http schemes', () => {
    expect(validateBaseUrl('')).toMatch(/empty/);
    expect(validateBaseUrl('ftp://x')).toMatch(/http/);
    expect(validateBaseUrl('not a url')).toMatch(/valid URL/);
  });
});
