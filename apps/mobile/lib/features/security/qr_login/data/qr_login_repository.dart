import 'package:mobile/core/config/api_config.dart';
import 'package:mobile/core/platform/device_platform.dart';
import 'package:mobile/core/utils/device_info.dart';
import 'package:mobile/data/sources/api_client.dart';
import 'package:mobile/features/security/qr_login/qr_login_payload.dart';

class QrLoginRepository {
  QrLoginRepository({
    ApiClient? apiClient,
    DevicePlatform? devicePlatform,
  }) : _apiClient = apiClient ?? ApiClient(),
       _devicePlatform = devicePlatform ?? const DefaultDevicePlatform();

  final ApiClient _apiClient;
  final DevicePlatform _devicePlatform;

  String? get _platform {
    if (_devicePlatform.isIOS) {
      return 'ios';
    }
    if (_devicePlatform.isAndroid) {
      return 'android';
    }
    return null;
  }

  Future<({bool success, String? error})> approve(
    QrLoginPayload payload,
  ) async {
    try {
      final deviceId = await getDeviceId();
      final response = await _apiClient.postJson(
        AuthEndpoints.qrLoginApprove(payload.challengeId),
        {
          'secret': payload.secret,
          if (deviceId != null) 'deviceId': deviceId,
          if (_platform != null) 'platform': _platform,
        },
      );

      if (response['error'] != null) {
        return (success: false, error: response['error'] as String);
      }

      return (success: response['success'] == true, error: null);
    } on ApiException catch (error) {
      return (success: false, error: error.message);
    } on Exception catch (error) {
      return (success: false, error: error.toString());
    }
  }
}
