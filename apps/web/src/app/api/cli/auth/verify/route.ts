import { createPOST } from '@tuturuuu/auth/cross-app/server';

export const POST = createPOST('platform', {
  sessionMetadata: {
    auth_client: 'cli',
    origin: 'TUTURUUU_CLI',
    session_label: 'Tuturuuu CLI',
  },
});
