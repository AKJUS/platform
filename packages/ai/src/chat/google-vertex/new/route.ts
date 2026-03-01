/**
 * @deprecated Use the centralized route at `@tuturuuu/ai/chat/google/new/route` instead.
 */
import { createPOST } from '../../google/new/route';

const POST = createPOST({ defaultProvider: 'vertex' });

export { POST };
