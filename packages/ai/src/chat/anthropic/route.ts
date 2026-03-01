/**
 * @deprecated Use the centralized route at `@tuturuuu/ai/chat/google/route` instead.
 * This re-exports the unified handler with 'anthropic' as the default provider
 * for backward compatibility with existing Rewise routes.
 */
import { createPOST } from '../google/route';

const POST = createPOST({ defaultProvider: 'anthropic' });

export { POST };
