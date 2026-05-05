interface CompleteVerifiedMfaSignInOptions {
  clearMfaRequirement: () => void;
  fallbackToHome: () => void;
  onNavigationError?: (error: unknown) => void;
  onSessionRefreshError?: (error: unknown) => void;
  processNextUrl: () => Promise<void>;
  refreshSession: () => Promise<{ error?: unknown } | null | undefined>;
  resetTotp: () => void;
}

export async function completeVerifiedMfaSignIn({
  clearMfaRequirement,
  fallbackToHome,
  onNavigationError,
  onSessionRefreshError,
  processNextUrl,
  refreshSession,
  resetTotp,
}: CompleteVerifiedMfaSignInOptions) {
  try {
    const refreshResult = await refreshSession();
    if (refreshResult?.error) {
      onSessionRefreshError?.(refreshResult.error);
    }
  } catch (error) {
    onSessionRefreshError?.(error);
  }

  clearMfaRequirement();
  resetTotp();

  try {
    await processNextUrl();
  } catch (error) {
    onNavigationError?.(error);
    fallbackToHome();
  }
}
