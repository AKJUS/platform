import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class AppLockSettingsStore {
  Future<bool> isEnabled();

  Future<void> setEnabled({required bool enabled});
}

class SecureStorageAppLockSettingsStore implements AppLockSettingsStore {
  SecureStorageAppLockSettingsStore({
    FlutterSecureStorage secureStorage = const FlutterSecureStorage(),
  }) : _secureStorage = secureStorage;

  static const _enabledKey = 'app-lock-enabled';

  final FlutterSecureStorage _secureStorage;

  @override
  Future<bool> isEnabled() async {
    final value = await _secureStorage.read(key: _enabledKey);
    return value == 'true';
  }

  @override
  Future<void> setEnabled({required bool enabled}) async {
    await _secureStorage.write(key: _enabledKey, value: enabled.toString());
  }
}
