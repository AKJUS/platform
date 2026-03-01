import { createPATCH } from '@tuturuuu/ai/chat/google/summary/route';

export const preferredRegion = 'sin1';
export const runtime = 'edge';

// Unified summary endpoint — generates a chat summary.
const PATCH = createPATCH();

export { PATCH };
