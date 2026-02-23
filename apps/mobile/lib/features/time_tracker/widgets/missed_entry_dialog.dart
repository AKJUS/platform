import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart'
    hide AlertDialog, FilledButton, TextButton, TextField;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:mobile/data/models/time_tracking/category.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class MissedEntryDialog extends StatefulWidget {
  const MissedEntryDialog({
    required this.categories,
    required this.onSave,
    this.thresholdDays,
    this.initialStartTime,
    this.initialEndTime,
    this.initialTitle,
    this.initialDescription,
    this.initialCategoryId,
    super.key,
  });

  final List<TimeTrackingCategory> categories;
  final void Function({
    required String title,
    required DateTime startTime,
    required DateTime endTime,
    required bool shouldSubmitAsRequest,
    required List<String> imagePaths,
    String? categoryId,
    String? description,
  })
  onSave;
  final int? thresholdDays;
  final DateTime? initialStartTime;
  final DateTime? initialEndTime;
  final String? initialTitle;
  final String? initialDescription;
  final String? initialCategoryId;

  @override
  State<MissedEntryDialog> createState() => _MissedEntryDialogState();
}

class _MissedEntryDialogState extends State<MissedEntryDialog> {
  final ImagePicker _picker = ImagePicker();
  late final TextEditingController _titleCtrl;
  late final TextEditingController _descCtrl;
  final List<XFile> _images = [];
  String? _categoryId;
  late DateTime _startTime;
  late DateTime _endTime;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController();
    _descCtrl = TextEditingController();
    _titleCtrl.text = widget.initialTitle ?? '';
    _descCtrl.text = widget.initialDescription ?? '';
    _categoryId = widget.initialCategoryId;
    final now = DateTime.now();
    _endTime = widget.initialEndTime ?? now;
    _startTime =
        widget.initialStartTime ?? now.subtract(const Duration(hours: 1));
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = shad.Theme.of(context);
    final dateFmt = DateFormat.yMMMd();
    final timeFmt = DateFormat.Hm();

    final duration = _endTime.difference(_startTime);
    final durationText = _formatDuration(duration);
    final showThresholdWarning = _isOlderThanThreshold;
    final requiresProof = showThresholdWarning;

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.mutedForeground.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const shad.Gap(16),
          Text(
            l10n.timerAddMissedEntry,
            style: theme.typography.h3,
          ),
          const shad.Gap(24),
          shad.FormField(
            key: const shad.FormKey<String>(#missedEntryTitle),
            label: Text(l10n.timerSessionTitle),
            child: shad.TextField(
              controller: _titleCtrl,
            ),
          ),
          const shad.Gap(16),
          shad.FormField(
            key: const shad.FormKey<String>(#missedEntryDesc),
            label: Text(l10n.timerDescription),
            child: shad.TextField(
              controller: _descCtrl,
              maxLines: 3,
            ),
          ),
          const shad.Gap(16),
          if (widget.categories.isNotEmpty)
            shad.FormField(
              key: const shad.FormKey<String?>(#missedEntryCategory),
              label: Text(l10n.timerCategory),
              child: shad.OutlineButton(
                onPressed: () {
                  shad.showDropdown<String?>(
                    context: context,
                    builder: (context) => shad.DropdownMenu(
                      children: [
                        shad.MenuButton(
                          onPressed: (context) {
                            setState(() => _categoryId = null);
                            Navigator.of(context).pop();
                          },
                          child: Text(l10n.timerNoCategory),
                        ),
                        ...widget.categories.map(
                          (c) => shad.MenuButton(
                            onPressed: (context) {
                              setState(() => _categoryId = c.id);
                              Navigator.of(context).pop();
                            },
                            child: Text(c.name ?? ''),
                          ),
                        ),
                      ],
                    ),
                  );
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      widget.categories
                              .where((c) => c.id == _categoryId)
                              .firstOrNull
                              ?.name ??
                          l10n.timerNoCategory,
                    ),
                    const Icon(shad.LucideIcons.chevronDown, size: 16),
                  ],
                ),
              ),
            ),
          const shad.Gap(16),
          _DateTimePicker(
            label: l10n.timerStartTime,
            value: _startTime,
            dateFmt: dateFmt,
            timeFmt: timeFmt,
            onChanged: (dt) => setState(() => _startTime = dt),
          ),
          const shad.Gap(12),
          _DateTimePicker(
            label: l10n.timerEndTime,
            value: _endTime,
            dateFmt: dateFmt,
            timeFmt: timeFmt,
            onChanged: (dt) => setState(() => _endTime = dt),
          ),
          if (showThresholdWarning) ...[
            const shad.Gap(12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: const Color(0xFFFFCC80),
                ),
              ),
              child: Text(
                widget.thresholdDays == 0
                    ? l10n.timerThresholdWarningAll
                    : l10n.timerThresholdWarning(widget.thresholdDays ?? 0),
                style: theme.typography.small,
              ),
            ),
            const shad.Gap(12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.timerRequestProofImagesCount(
                      _images.length,
                      _maxImages,
                    ),
                    style: theme.typography.small,
                  ),
                ),
                shad.OutlineButton(
                  onPressed: _images.length >= _maxImages
                      ? null
                      : () => unawaited(_pickImageSource()),
                  child: Text(l10n.timerRequestAddImage),
                ),
              ],
            ),
            const shad.Gap(8),
            if (_images.isNotEmpty)
              SizedBox(
                height: 76,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemBuilder: (context, index) {
                    final image = _images[index];
                    return Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(image.path),
                            width: 76,
                            height: 76,
                            fit: BoxFit.cover,
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _images.removeAt(index);
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close,
                                color: Colors.white,
                                size: 14,
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                  separatorBuilder: (_, _) => const shad.Gap(8),
                  itemCount: _images.length,
                ),
              ),
            if (requiresProof && _images.isEmpty) ...[
              const shad.Gap(8),
              Text(
                l10n.timerProofOfWorkRequired,
                style: theme.typography.small.copyWith(
                  color: theme.colorScheme.destructive,
                ),
              ),
            ],
          ],
          const shad.Gap(12),
          Text(
            '${l10n.timerDuration}: $durationText',
            style: theme.typography.small.copyWith(
              color: theme.colorScheme.mutedForeground,
            ),
          ),
          const shad.Gap(24),
          shad.PrimaryButton(
            onPressed: _isValid
                ? () {
                    widget.onSave(
                      title: _titleCtrl.text.isEmpty
                          ? l10n.timerWorkSession
                          : _titleCtrl.text,
                      categoryId: _categoryId,
                      startTime: _startTime,
                      endTime: _endTime,
                      shouldSubmitAsRequest: showThresholdWarning,
                      imagePaths: _images.map((file) => file.path).toList(),
                      description: _descCtrl.text.isEmpty
                          ? null
                          : _descCtrl.text,
                    );
                    Navigator.of(context).pop();
                  }
                : null,
            child: Text(
              showThresholdWarning
                  ? l10n.timerSubmitForApproval
                  : l10n.timerSave,
            ),
          ),
        ],
      ),
    );
  }

  bool get _isOlderThanThreshold {
    final thresholdDays = widget.thresholdDays;
    if (thresholdDays == null) {
      return false;
    }

    if (thresholdDays == 0) {
      return true;
    }

    final thresholdAgo = DateTime.now().subtract(Duration(days: thresholdDays));
    return _startTime.isBefore(thresholdAgo);
  }

  bool get _isValid {
    if (!_endTime.isAfter(_startTime)) {
      return false;
    }

    if (_isOlderThanThreshold && _images.isEmpty) {
      return false;
    }

    return true;
  }

  static const int _maxImages = 5;

  Future<void> _pickImageSource() async {
    final l10n = context.l10n;
    final source = await shad.showDialog<_ImageSourceSelection>(
      context: context,
      builder: (dialogCtx) {
        return shad.AlertDialog(
          barrierColor: Colors.transparent,
          title: Text(l10n.selectImageSource),
          actions: [
            shad.OutlineButton(
              onPressed: () =>
                  Navigator.of(dialogCtx).pop(_ImageSourceSelection.camera),
              child: Text(l10n.camera),
            ),
            shad.PrimaryButton(
              onPressed: () =>
                  Navigator.of(dialogCtx).pop(_ImageSourceSelection.gallery),
              child: Text(l10n.gallery),
            ),
          ],
        );
      },
    );

    if (source == null) {
      return;
    }

    if (source == _ImageSourceSelection.camera) {
      final image = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      if (image != null && _images.length < _maxImages) {
        setState(() {
          _images.add(image);
        });
      }
      return;
    }

    final images = await _picker.pickMultiImage(imageQuality: 85);
    if (images.isEmpty) {
      return;
    }

    setState(() {
      for (final image in images) {
        if (_images.length >= _maxImages) {
          break;
        }
        _images.add(image);
      }
    });
  }

  String _formatDuration(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.abs() % 60;
    final s = d.inSeconds.abs() % 60;
    if (h > 0) return '${h}h ${m}m';
    if (m > 0) return '${m}m ${s}s';
    return '${s}s';
  }
}

enum _ImageSourceSelection { camera, gallery }

class _DateTimePicker extends StatelessWidget {
  const _DateTimePicker({
    required this.label,
    required this.value,
    required this.dateFmt,
    required this.timeFmt,
    required this.onChanged,
  });

  final String label;
  final DateTime value;
  final DateFormat dateFmt;
  final DateFormat timeFmt;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = shad.Theme.of(context);
    return Row(
      children: [
        Text(
          label,
          style: theme.typography.small,
        ),
        const Spacer(),
        shad.GhostButton(
          onPressed: () async {
            final date = await showDatePicker(
              context: context,
              initialDate: value,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
            );
            if (date != null) {
              onChanged(
                DateTime(
                  date.year,
                  date.month,
                  date.day,
                  value.hour,
                  value.minute,
                ),
              );
            }
          },
          child: Text(dateFmt.format(value.toLocal())),
        ),
        shad.GhostButton(
          onPressed: () async {
            final time = await showTimePicker(
              context: context,
              initialTime: TimeOfDay.fromDateTime(value.toLocal()),
            );
            if (time != null) {
              onChanged(
                DateTime(
                  value.year,
                  value.month,
                  value.day,
                  time.hour,
                  time.minute,
                ),
              );
            }
          },
          child: Text(timeFmt.format(value.toLocal())),
        ),
      ],
    );
  }
}
