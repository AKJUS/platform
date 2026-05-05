import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/security/qr_login/qr_login_payload.dart';

void main() {
  group('QrLoginPayload', () {
    test('parses Tuturuuu QR login payloads', () {
      final payload = QrLoginPayload.parse(
        'tuturuuu://auth/qr-login?challengeId=challenge-1'
        '&secret=secret-token'
        '&origin=https%3A%2F%2Ftuturuuu.com',
      );

      expect(payload, isNotNull);
      expect(payload!.challengeId, 'challenge-1');
      expect(payload.secret, 'secret-token');
      expect(payload.origin.toString(), 'https://tuturuuu.com');
    });

    test('rejects non-Tuturuuu QR payloads', () {
      expect(QrLoginPayload.parse('https://example.com'), isNull);
      expect(
        QrLoginPayload.parse(
          'tuturuuu://auth/qr-login?challengeId=challenge-1'
          '&secret=secret-token'
          '&origin=https%3A%2F%2Fevil.example',
        ),
        isNull,
      );
    });

    test('rejects missing challenge data', () {
      expect(
        QrLoginPayload.parse(
          'tuturuuu://auth/qr-login?challengeId=challenge-1',
        ),
        isNull,
      );
    });
  });
}
