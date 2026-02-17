import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { distributeBalanced, distributeByCount } from './distribute';

// Helper to create simple ReactNode placeholders
const node = (index: number) =>
  createElement('div', { key: index }, `Item ${index}`);

// Helper: compute column heights from a distribution result + height map
function columnHeightsOf(
  result: ReturnType<typeof distributeBalanced>,
  heights: Map<number, number>,
  gap = 0
): number[] {
  return result.map((col) =>
    col.reduce(
      (sum, item) => sum + (heights.get(item.originalIndex) ?? 0) + gap,
      0
    )
  );
}

function rangeOf(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

// ─────────────────────────────────────────────────────────────────────────────
// distributeByCount
// ─────────────────────────────────────────────────────────────────────────────
describe('distributeByCount', () => {
  it('distributes items evenly across columns', () => {
    const children = Array.from({ length: 6 }, (_, i) => node(i));
    const result = distributeByCount(children, 3);

    expect(result.length).toBe(3);
    for (const column of result) {
      expect(column.length).toBe(2);
    }
  });

  it('handles uneven distribution', () => {
    const children = Array.from({ length: 7 }, (_, i) => node(i));
    const result = distributeByCount(children, 3);

    const counts = result.map((col) => col.length);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(7);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('preserves original indices', () => {
    const children = Array.from({ length: 4 }, (_, i) => node(i));
    const result = distributeByCount(children, 2);

    const allIndices = result.flatMap((col) =>
      col.map((item) => item.originalIndex)
    );
    expect(allIndices.sort()).toEqual([0, 1, 2, 3]);
  });

  it('handles single column', () => {
    const children = Array.from({ length: 3 }, (_, i) => node(i));
    const result = distributeByCount(children, 1);

    expect(result.length).toBe(1);
    expect(result[0]!.length).toBe(3);
  });

  it('handles empty children', () => {
    const result = distributeByCount([], 3);
    expect(result.length).toBe(3);
    for (const col of result) {
      expect(col.length).toBe(0);
    }
  });

  it('round-robins to shortest column', () => {
    const children = Array.from({ length: 5 }, (_, i) => node(i));
    const result = distributeByCount(children, 3);

    // 5 items, 3 columns → 2, 2, 1
    const counts = result.map((col) => col.length);
    expect(counts).toEqual([2, 2, 1]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// distributeBalanced
// ─────────────────────────────────────────────────────────────────────────────
describe('distributeBalanced', () => {
  it('distributes items based on measured heights', () => {
    const children = Array.from({ length: 4 }, (_, i) => node(i));
    const heights = new Map([
      [0, 100],
      [1, 200],
      [2, 150],
      [3, 50],
    ]);

    const result = distributeBalanced(children, 2, 0, heights, 200);

    expect(result.length).toBe(2);
    const total = result.reduce((sum, col) => sum + col.length, 0);
    expect(total).toBe(4);
  });

  it('preserves original indices', () => {
    const children = Array.from({ length: 6 }, (_, i) => node(i));
    const heights = new Map([
      [0, 300],
      [1, 200],
      [2, 100],
      [3, 150],
      [4, 250],
      [5, 50],
    ]);

    const result = distributeBalanced(children, 3, 0, heights, 200);

    const allIndices = result.flatMap((col) =>
      col.map((item) => item.originalIndex)
    );
    expect(allIndices.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('minimizes column height variance', () => {
    const children = Array.from({ length: 4 }, (_, i) => node(i));
    const heights = new Map([
      [0, 100],
      [1, 200],
      [2, 50],
      [3, 150],
    ]);

    const result = distributeBalanced(children, 2, 0, heights, 200);
    const colHeights = columnHeightsOf(result, heights);
    const range = rangeOf(colHeights);

    // Optimal: [200,50]=250 vs [100,150]=250 → range=0
    expect(range).toBe(0);
  });

  it('uses average height for unmeasured items', () => {
    const children = Array.from({ length: 4 }, (_, i) => node(i));
    const heights = new Map([
      [0, 100],
      [1, 200],
    ]);

    const result = distributeBalanced(children, 2, 16, heights, 150);

    const total = result.reduce((sum, col) => sum + col.length, 0);
    expect(total).toBe(4);
  });

  it('handles identical heights', () => {
    const children = Array.from({ length: 4 }, (_, i) => node(i));
    const heights = new Map([
      [0, 100],
      [1, 100],
      [2, 100],
      [3, 100],
    ]);

    const result = distributeBalanced(children, 2, 0, heights, 100);
    expect(result[0]!.length).toBe(2);
    expect(result[1]!.length).toBe(2);
  });

  it('handles empty children', () => {
    const result = distributeBalanced([], 3, 16, new Map(), 200);
    expect(result.length).toBe(3);
    for (const col of result) {
      expect(col.length).toBe(0);
    }
  });

  it('handles single column', () => {
    const children = Array.from({ length: 5 }, (_, i) => node(i));
    const heights = new Map<number, number>();
    children.forEach((_, i) => heights.set(i, 100 + i * 20));

    const result = distributeBalanced(children, 1, 0, heights, 150);
    expect(result.length).toBe(1);
    expect(result[0]!.length).toBe(5);
  });

  it('handles gap in height calculations', () => {
    const children = Array.from({ length: 4 }, (_, i) => node(i));
    const heights = new Map([
      [0, 100],
      [1, 100],
      [2, 100],
      [3, 100],
    ]);

    const result = distributeBalanced(children, 2, 10, heights, 100);
    expect(result[0]!.length).toBe(2);
    expect(result[1]!.length).toBe(2);
  });

  it('optimization converges quickly for well-distributed inputs', () => {
    const children = Array.from({ length: 20 }, (_, i) => node(i));
    const heights = new Map<number, number>();
    for (let i = 0; i < 20; i++) {
      heights.set(i, 100 + (i % 3) * 50);
    }

    const result = distributeBalanced(children, 4, 8, heights, 150);
    const total = result.reduce((sum, col) => sum + col.length, 0);
    expect(total).toBe(20);
    expect(result.length).toBe(4);
  });

  // ── Tests specifically for the move + swap optimization ──────────────

  it('swap optimization fixes greedy-stuck distributions', () => {
    // 7 items in 3 columns — greedy alone produces range=40,
    // but optimal (via swaps) is range ≤ 20.
    const children = Array.from({ length: 7 }, (_, i) => node(i));
    const heights = new Map([
      [0, 100],
      [1, 90],
      [2, 80],
      [3, 70],
      [4, 60],
      [5, 50],
      [6, 40],
    ]);

    const result = distributeBalanced(children, 3, 0, heights, 100);
    const colHeights = columnHeightsOf(result, heights);
    const range = rangeOf(colHeights);

    // Must beat the old greedy-only result (range=40)
    expect(range).toBeLessThanOrEqual(20);
  });

  it('produces tight balance for realistic member card heights', () => {
    // Simulates member cards with varying content heights
    const cardHeights = [
      280, 220, 340, 195, 260, 310, 185, 245, 290, 210, 325, 200,
    ];
    const children = Array.from({ length: cardHeights.length }, (_, i) =>
      node(i)
    );
    const heights = new Map(cardHeights.map((h, i) => [i, h]));

    const result = distributeBalanced(children, 2, 16, heights, 250);
    const colHeights = columnHeightsOf(result, heights, 16);
    const range = rangeOf(colHeights);

    // Total = 3060 + 12*16 gap = 3252, ideal per col = 1626
    // Range should be small relative to total — within ~5%
    const avgCol = colHeights.reduce((a, b) => a + b, 0) / 2;
    expect(range / avgCol).toBeLessThan(0.05);
  });

  it('handles many columns with varied heights', () => {
    const itemHeights = [
      500, 350, 420, 280, 390, 310, 200, 450, 270, 330, 180, 410, 260, 370,
      150, 340, 290, 380, 220, 460,
    ];
    const children = Array.from({ length: itemHeights.length }, (_, i) =>
      node(i)
    );
    const heights = new Map(itemHeights.map((h, i) => [i, h]));

    const result = distributeBalanced(children, 4, 8, heights, 300);
    const colHeights = columnHeightsOf(result, heights, 8);
    const range = rangeOf(colHeights);

    // 4 columns should be well-balanced
    const avgCol = colHeights.reduce((a, b) => a + b, 0) / 4;
    expect(range / avgCol).toBeLessThan(0.1);
  });

  it('optimizes a pathological case where greedy is suboptimal', () => {
    // Two very tall items + many small ones
    const children = Array.from({ length: 8 }, (_, i) => node(i));
    const heights = new Map([
      [0, 400],
      [1, 380],
      [2, 50],
      [3, 50],
      [4, 50],
      [5, 50],
      [6, 50],
      [7, 50],
    ]);

    const result = distributeBalanced(children, 2, 0, heights, 200);
    const colHeights = columnHeightsOf(result, heights);

    // Total = 1080, ideal per col = 540
    // Optimal: [400,50,50,50]=550 vs [380,50,50,50]=530, range=20
    const range = rangeOf(colHeights);
    expect(range).toBeLessThanOrEqual(20);
  });
});
