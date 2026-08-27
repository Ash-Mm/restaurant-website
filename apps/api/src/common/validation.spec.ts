import { describe, expect, it } from '@jest/globals';
import { slugSchema, isSlugSafe } from '@restaurant/contracts';

describe('slug validation', () => {
  it('accepts safe slugs', () => {
    expect(isSlugSafe('acme')).toBe(true);
    expect(isSlugSafe('acme-1')).toBe(true);
    expect(isSlugSafe('my-restaurant')).toBe(true);
  });

  it('rejects unsafe slugs', () => {
    expect(isSlugSafe('AB')).toBe(false);
    expect(isSlugSafe('a')).toBe(false);
    expect(isSlugSafe('a b')).toBe(false);
    expect(isSlugSafe('a_b')).toBe(false);
    expect(isSlugSafe('-acme')).toBe(false);
    expect(isSlugSafe('acme-')).toBe(false);
  });

  it('schema parses a valid slug', () => {
    expect(slugSchema.parse('acme')).toBe('acme');
  });

  it('schema throws on an invalid slug', () => {
    expect(() => slugSchema.parse('A B')).toThrow();
  });
});
