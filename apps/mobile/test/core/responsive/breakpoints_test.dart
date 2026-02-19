import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/responsive/breakpoints.dart';

void main() {
  group('Breakpoints.fromWidth', () {
    test('returns compact for width < 600', () {
      expect(Breakpoints.fromWidth(0), DeviceClass.compact);
      expect(Breakpoints.fromWidth(320), DeviceClass.compact);
      expect(Breakpoints.fromWidth(599), DeviceClass.compact);
    });

    test('returns medium for width >= 600 and < 840', () {
      expect(Breakpoints.fromWidth(600), DeviceClass.medium);
      expect(Breakpoints.fromWidth(700), DeviceClass.medium);
      expect(Breakpoints.fromWidth(839), DeviceClass.medium);
    });

    test('returns expanded for width >= 840', () {
      expect(Breakpoints.fromWidth(840), DeviceClass.expanded);
      expect(Breakpoints.fromWidth(1024), DeviceClass.expanded);
      expect(Breakpoints.fromWidth(1920), DeviceClass.expanded);
    });

    test('boundary values are correct', () {
      expect(Breakpoints.fromWidth(599.9), DeviceClass.compact);
      expect(Breakpoints.fromWidth(600), DeviceClass.medium);
      expect(Breakpoints.fromWidth(839.9), DeviceClass.medium);
      expect(Breakpoints.fromWidth(840), DeviceClass.expanded);
    });
  });

  group('Breakpoints constants', () {
    test('mediumMin is 600', () {
      expect(Breakpoints.mediumMin, 600);
    });

    test('expandedMin is 840', () {
      expect(Breakpoints.expandedMin, 840);
    });
  });
}
