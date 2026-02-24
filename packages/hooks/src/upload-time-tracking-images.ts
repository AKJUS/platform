/**
 * Uploads image files to Supabase Storage via signed upload URLs.
 * Used by missed-entry create and request edit flows.
 *
 * @param baseUrl - API base URL (e.g. /api/v1/workspaces)
 * @param wsId - Workspace ID
 * @param requestId - Request ID (for create: client-generated UUID; for edit: existing request ID)
 * @param files - Image files to upload
 * @returns Array of storage paths
 */
export async function uploadTimeTrackingImages(
  baseUrl: string,
  wsId: string,
  requestId: string,
  files: File[]
): Promise<string[]> {
  const uploadUrl = `${baseUrl}/${wsId}/time-tracking/requests/upload-url`;
  const signedRes = await fetch(uploadUrl, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      files: files.map((file) => ({ filename: file.name })),
    }),
  });

  if (!signedRes.ok) {
    const body = await signedRes.json().catch(() => ({}));
    const msg =
      (body as { error?: string }).error ??
      `Failed to generate upload URLs (HTTP ${signedRes.status})`;
    throw new Error(msg);
  }

  const { uploads } = (await signedRes.json()) as {
    uploads: Array<{
      signedUrl: string;
      token: string;
      path: string;
    }>;
  };

  if (!Array.isArray(uploads) || uploads.length !== files.length) {
    throw new Error('Upload URL response mismatch');
  }

  const paths = await Promise.all(
    uploads.map(async ({ signedUrl, token, path }, index) => {
      const file = files[index];
      if (!file) {
        throw new Error('Upload URL response mismatch');
      }
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'image/jpeg',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => '');
        throw new Error(
          `Upload failed (${uploadRes.status}): ${text || 'Unknown error'}`
        );
      }

      return path;
    })
  );

  return paths;
}
