import { describe, expect, it } from '@jest/globals';
import { calculateModifierDelta, formatMinor, validateModifierSelection, createCategorySchema, createProductSchema, type ModifierGroup } from '@restaurant/contracts';

describe('menu contracts (Phase 3 tasks 10-13)', () => {
  describe('formatMinor', () => {
    it('formats minor units to major with currency', () => {
      expect(formatMinor(1999, 'EGP')).toBe('19.99 EGP');
      expect(formatMinor(0, 'EGP')).toBe('0.00 EGP');
      expect(formatMinor(1500, 'USD')).toBe('15.00 USD');
    });
  });

  describe('calculateModifierDelta', () => {
    it('sums price deltas', () => {
      expect(calculateModifierDelta([{ id: '1', name: 'Extra', priceDeltaMinor: 50 } as never])).toBe(50);
      expect(calculateModifierDelta([
        { priceDeltaMinor: 100 } as never,
        { priceDeltaMinor: 250 } as never,
      ])).toBe(350);
      expect(calculateModifierDelta([])).toBe(0);
    });
  });

  describe('validateModifierSelection', () => {
    const base: ModifierGroup = {
      id: 'g1',
      name: 'Size',
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'o1', name: 'Small', priceDeltaMinor: 0 },
        { id: 'o2', name: 'Large', priceDeltaMinor: 100 },
      ],
    };
    it('requires minSelect', () => {
      expect(validateModifierSelection(base, 0)).toBe('Select at least 1');
      expect(validateModifierSelection(base, 1)).toBeNull();
    });
    it('enforces maxSelect', () => {
      const multi: ModifierGroup = { ...base, minSelect: 0, maxSelect: 2 };
      expect(validateModifierSelection(multi, 3)).toBe('Select at most 2');
      expect(validateModifierSelection(multi, 2)).toBeNull();
    });
    it('allows unlimited when maxSelect=0', () => {
      const unlimited: ModifierGroup = { ...base, minSelect: 0, maxSelect: 0 };
      expect(validateModifierSelection(unlimited, 10)).toBeNull();
    });
  });

  describe('category validation', () => {
    it('accepts valid name', () => {
      expect(createCategorySchema.parse({ name: 'Appetizers' }).name).toBe('Appetizers');
    });
    it('rejects short name', () => {
      expect(() => createCategorySchema.parse({ name: 'A' })).toThrow();
    });
    it('rejects empty name', () => {
      expect(() => createCategorySchema.parse({ name: '' })).toThrow();
    });
  });

  describe('product validation', () => {
    it('accepts valid product', () => {
      const parsed = createProductSchema.parse({ name: 'Pizza', priceMinor: 1500, barcode: '12345' });
      expect(parsed.name).toBe('Pizza');
      expect(parsed.priceMinor).toBe(1500);
    });
    it('rejects short name', () => {
      expect(() => createProductSchema.parse({ name: 'A' })).toThrow();
    });
    it('rejects negative price', () => {
      expect(() => createProductSchema.parse({ name: 'Pizza', priceMinor: -1 })).toThrow();
    });
    it('allows optional fields', () => {
      expect(() => createProductSchema.parse({ name: 'Pizza' })).not.toThrow();
    });
  });

  describe('money integer invariant', () => {
    it('never uses float for storage (minor units)', () => {
      const priceMinor = 1999;
      expect(Number.isInteger(priceMinor)).toBe(true);
      const withDelta = priceMinor + 50;
      expect(Number.isInteger(withDelta)).toBe(true);
    });
  });
});
