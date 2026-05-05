class QrLoginPayload {
  const QrLoginPayload({
    required this.challengeId,
    required this.origin,
    required this.secret,
  });

  final String challengeId;
  final Uri origin;
  final String secret;

  static QrLoginPayload? parse(String? value) {
    if (value == null || value.trim().isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(value.trim());
    if (uri == null || uri.scheme != 'tuturuuu') {
      return null;
    }

    if (uri.host != 'auth' || uri.path != '/qr-login') {
      return null;
    }

    final challengeId = uri.queryParameters['challengeId']?.trim();
    final secret = uri.queryParameters['secret']?.trim();
    final origin = Uri.tryParse(uri.queryParameters['origin']?.trim() ?? '');

    if (challengeId == null ||
        challengeId.isEmpty ||
        secret == null ||
        secret.isEmpty ||
        origin == null ||
        !isTrustedQrLoginOrigin(origin)) {
      return null;
    }

    return QrLoginPayload(
      challengeId: challengeId,
      origin: origin,
      secret: secret,
    );
  }
}

bool isTrustedQrLoginOrigin(Uri origin) {
  if (origin.scheme != 'https' && origin.scheme != 'http') {
    return false;
  }

  final host = origin.host.toLowerCase();
  return origin.scheme == 'https' &&
          (host == 'tuturuuu.com' || host.endsWith('.tuturuuu.com')) ||
      host == 'localhost' ||
      host == '127.0.0.1' ||
      host == '10.0.2.2';
}
