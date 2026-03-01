import { createPOST } from '@tuturuuu/ai/chat/google/new/route';

export const preferredRegion = 'sin1';
export const runtime = 'edge';

// Unified new-chat endpoint — creates a chat and generates a title.
const POST = createPOST();

export { POST };
