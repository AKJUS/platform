import { createPOST } from '@tuturuuu/ai/chat/google/new/route';

export const maxDuration = 90;
export const preferredRegion = 'sin1';

// Unified new-chat endpoint — creates a chat and generates a title.
const POST = createPOST();

export { POST };
