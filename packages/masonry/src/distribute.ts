import type { ReactNode } from 'react';

export interface DistributedItem {
  child: ReactNode;
  originalIndex: number;
}

/**
 * Distribute items across columns by count (round-robin to shortest column).
 * Pure function — no React state dependencies.
 */
export function distributeByCount(
  children: ReactNode[],
  columnCount: number
): DistributedItem[][] {
  const columns: DistributedItem[][] = Array.from(
    { length: columnCount },
    () => []
  );
  const columnItemCounts = Array(columnCount).fill(0) as number[];

  children.forEach((child, index) => {
    let shortestColumnIndex = 0;
    let minCount = columnItemCounts[0] ?? 0;

    for (let i = 1; i < columnCount; i++) {
      const count = columnItemCounts[i] ?? 0;
      if (count < minCount) {
        minCount = count;
        shortestColumnIndex = i;
      }
    }

    const column = columns[shortestColumnIndex];
    if (column) {
      column.push({ child, originalIndex: index });
      columnItemCounts[shortestColumnIndex] =
        (columnItemCounts[shortestColumnIndex] ?? 0) + 1;
    }
  });

  return columns;
}

interface ItemMetadata {
  child: ReactNode;
  originalIndex: number;
  height: number;
}

// Helper to compute max - min of an array
function getHeightRange(heights: number[]): number {
  let max = -Infinity;
  let min = Infinity;
  for (const h of heights) {
    if (h > max) max = h;
    if (h < min) min = h;
  }
  return max - min;
}

/**
 * Distribute items across columns using measured heights for visual balance.
 *
 * Algorithm:
 *   Phase 1 — Largest-First greedy: place each item (tallest first) into the
 *             column that minimizes the max-min height range.
 *   Phase 2 — Move optimization: try moving any item to any other column.
 *   Phase 3 — Swap optimization: try swapping items between the tallest and
 *             shortest columns. Swaps catch cases single moves cannot improve.
 *
 * Pure function — caller provides heights map and average fallback.
 */
export function distributeBalanced(
  children: ReactNode[],
  columnCount: number,
  gap: number,
  itemHeights: Map<number, number>,
  averageHeight: number
): DistributedItem[][] {
  if (columnCount <= 1 || children.length === 0) {
    // Trivial cases — no balancing needed
    const columns: DistributedItem[][] = Array.from(
      { length: columnCount },
      () => []
    );
    children.forEach((child, index) => {
      columns[0]?.push({ child, originalIndex: index });
    });
    return columns;
  }

  const itemsWithHeights: ItemMetadata[] = children.map((child, index) => {
    let effectiveHeight = itemHeights.get(index);
    if (effectiveHeight === undefined || effectiveHeight <= 0) {
      effectiveHeight = averageHeight;
    }
    return { child, originalIndex: index, height: effectiveHeight };
  });

  // Sort items by height descending (Largest First)
  const sortedItems = [...itemsWithHeights].sort((a, b) => b.height - a.height);

  const columnAssignments: number[] = new Array(sortedItems.length);
  const columnHeights = new Array<number>(columnCount).fill(0);

  // ── Phase 1: Greedy placement ─────────────────────────────────────────
  // Place each item (tallest first) into the column that produces the
  // smallest height range after insertion.
  for (let idx = 0; idx < sortedItems.length; idx++) {
    const item = sortedItems[idx]!;
    let bestCol = 0;
    let bestRange = Infinity;

    for (let c = 0; c < columnCount; c++) {
      const testHeight = columnHeights[c]! + item.height + gap;
      // Compute range inline — avoid copying the array each time
      let max = testHeight;
      let min = testHeight;
      for (let j = 0; j < columnCount; j++) {
        const h = j === c ? testHeight : columnHeights[j]!;
        if (h > max) max = h;
        if (h < min) min = h;
      }
      const range = max - min;

      if (range < bestRange - 1) {
        bestRange = range;
        bestCol = c;
      } else if (Math.abs(range - bestRange) <= 1) {
        if (columnHeights[c]! < columnHeights[bestCol]!) {
          bestCol = c;
        }
      }
    }

    columnAssignments[idx] = bestCol;
    columnHeights[bestCol]! += item.height + gap;
  }

  // ── Phase 2: Move optimization ────────────────────────────────────────
  // Try moving ANY item to ANY other column. Pick the single best move per
  // pass. Stop when no move improves the range or we hit the pass limit.
  let passCount = 0;
  const maxMovePasses = 15;

  for (let pass = 0; pass < maxMovePasses; pass++) {
    const currentRange = getHeightRange(columnHeights);
    if (currentRange < Math.max(5, Math.min(...columnHeights) * 0.005)) break;

    let bestImprovement = 0;
    let bestItemIdx = -1;
    let bestTargetCol = -1;

    for (let i = 0; i < sortedItems.length; i++) {
      const srcCol = columnAssignments[i]!;
      const h = sortedItems[i]!.height + gap;

      for (let tgt = 0; tgt < columnCount; tgt++) {
        if (tgt === srcCol) continue;

        // Compute new range after moving item i from srcCol → tgt
        const srcNew = columnHeights[srcCol]! - h;
        const tgtNew = columnHeights[tgt]! + h;

        let max = -Infinity;
        let min = Infinity;
        for (let c = 0; c < columnCount; c++) {
          const val =
            c === srcCol ? srcNew : c === tgt ? tgtNew : columnHeights[c]!;
          if (val > max) max = val;
          if (val < min) min = val;
        }

        const improvement = currentRange - (max - min);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestItemIdx = i;
          bestTargetCol = tgt;
        }
      }
    }

    if (bestImprovement <= 0 || bestItemIdx < 0) break;

    // Apply the best move
    const srcCol = columnAssignments[bestItemIdx]!;
    const h = sortedItems[bestItemIdx]!.height + gap;
    columnHeights[srcCol]! -= h;
    columnHeights[bestTargetCol]! += h;
    columnAssignments[bestItemIdx] = bestTargetCol;
    passCount++;
  }

  // ── Phase 3: Swap optimization ────────────────────────────────────────
  // Try swapping one item from the tallest column with one from the
  // shortest column. This catches imbalances that single moves can't fix
  // (e.g., moving either item alone overshoots, but swapping is just right).
  const maxSwapPasses = 10 - Math.min(passCount, 5); // budget remaining

  for (let pass = 0; pass < maxSwapPasses; pass++) {
    const currentRange = getHeightRange(columnHeights);
    if (currentRange < Math.max(5, Math.min(...columnHeights) * 0.005)) break;

    // Find tallest and shortest columns
    let tallestCol = 0;
    let shortestCol = 0;
    for (let c = 1; c < columnCount; c++) {
      if (columnHeights[c]! > columnHeights[tallestCol]!) tallestCol = c;
      if (columnHeights[c]! < columnHeights[shortestCol]!) shortestCol = c;
    }
    if (tallestCol === shortestCol) break;

    let bestImprovement = 0;
    let bestA = -1;
    let bestB = -1;

    // Collect indices of items in each column
    for (let a = 0; a < sortedItems.length; a++) {
      if (columnAssignments[a] !== tallestCol) continue;
      const hA = sortedItems[a]!.height;

      for (let b = 0; b < sortedItems.length; b++) {
        if (columnAssignments[b] !== shortestCol) continue;
        const hB = sortedItems[b]!.height;

        // Only consider swaps where we move height FROM tall TO short
        if (hA <= hB) continue;

        // Simulate swap
        const tallNew = columnHeights[tallestCol]! - hA + hB;
        const shortNew = columnHeights[shortestCol]! + hA - hB;

        let max = -Infinity;
        let min = Infinity;
        for (let c = 0; c < columnCount; c++) {
          const val =
            c === tallestCol
              ? tallNew
              : c === shortestCol
                ? shortNew
                : columnHeights[c]!;
          if (val > max) max = val;
          if (val < min) min = val;
        }

        const improvement = currentRange - (max - min);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestA = a;
          bestB = b;
        }
      }
    }

    if (bestImprovement <= 0 || bestA < 0 || bestB < 0) break;

    // Apply swap
    const hA = sortedItems[bestA]!.height;
    const hB = sortedItems[bestB]!.height;
    columnHeights[tallestCol]! += hB - hA;
    columnHeights[shortestCol]! += hA - hB;
    columnAssignments[bestA] = shortestCol;
    columnAssignments[bestB] = tallestCol;
  }

  // ── Build final columns ───────────────────────────────────────────────
  const columns: DistributedItem[][] = Array.from(
    { length: columnCount },
    () => []
  );

  for (let i = 0; i < sortedItems.length; i++) {
    const colIdx = columnAssignments[i]!;
    columns[colIdx]!.push({
      child: sortedItems[i]!.child,
      originalIndex: sortedItems[i]!.originalIndex,
    });
  }

  return columns;
}
