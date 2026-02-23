bool exceedsThreshold(DateTime? startTime, int? thresholdDays) {
  if (startTime == null || thresholdDays == null) {
    return false;
  }

  if (thresholdDays == 0) {
    return true;
  }

  final thresholdAgo = DateTime.now().subtract(Duration(days: thresholdDays));
  return startTime.isBefore(thresholdAgo);
}
