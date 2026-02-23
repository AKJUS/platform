import 'package:flutter/material.dart'
    hide AlertDialog, FilledButton, OutlinedButton, TextField;
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class ThresholdSettingsDialog extends StatefulWidget {
  const ThresholdSettingsDialog({
    required this.currentThreshold,
    required this.onSave,
    super.key,
  });

  final int? currentThreshold;
  final Future<void> Function(int? threshold) onSave;

  @override
  State<ThresholdSettingsDialog> createState() =>
      _ThresholdSettingsDialogState();
}

class _ThresholdSettingsDialogState extends State<ThresholdSettingsDialog> {
  late final TextEditingController _thresholdController;
  late bool _noApprovalNeeded;
  bool _isSaving = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = shad.Theme.of(context);
      final barrierColor = Theme.of(
          context,
        ).colorScheme.scrim.withValues(alpha: 0.55);
    return shad.AlertDialog(
      barrierColor: barrierColor,
      title: Text(l10n.timerRequestsThresholdTitle),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.timerRequestsThresholdDescription,
              style: theme.typography.textMuted,
            ),
            const shad.Gap(16),
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.timerRequestsThresholdNoApproval,
                    style: theme.typography.small,
                  ),
                ),
                shad.Switch(
                  value: _noApprovalNeeded,
                  onChanged: _isSaving
                      ? null
                      : (value) {
                          setState(() {
                            _noApprovalNeeded = value;
                            _error = null;
                          });
                        },
                ),
              ],
            ),
            if (_noApprovalNeeded) ...[
              const shad.Gap(8),
              Text(
                l10n.timerRequestsThresholdNoApprovalHint,
                style: theme.typography.textMuted,
              ),
            ] else ...[
              const shad.Gap(12),
              Text(
                l10n.timerRequestsThresholdLabel,
                style: theme.typography.small,
              ),
              const shad.Gap(4),
              shad.TextField(
                controller: _thresholdController,
                keyboardType: TextInputType.number,
                placeholder: const Text('1'),
                enabled: !_isSaving,
              ),
              const shad.Gap(8),
              Text(
                l10n.timerRequestsThresholdHelp,
                style: theme.typography.textMuted,
              ),
            ],
            if (_error != null) ...[
              const shad.Gap(8),
              Text(
                _error!,
                style: theme.typography.small.copyWith(
                  color: theme.colorScheme.destructive,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        shad.OutlineButton(
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        shad.PrimaryButton(
          onPressed: _isSaving ? null : _handleSave,
          child: _isSaving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: shad.CircularProgressIndicator(),
                )
              : Text(l10n.timerSave),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _thresholdController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _noApprovalNeeded = widget.currentThreshold == null;
    _thresholdController = TextEditingController(
      text: widget.currentThreshold?.toString() ?? '1',
    );
  }

  Future<void> _handleSave() async {
    final threshold = _parseThreshold();
    if (!_noApprovalNeeded && threshold == null) {
      setState(() => _error = context.l10n.timerRequestsThresholdInvalid);
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    try {
      await widget.onSave(_noApprovalNeeded ? null : threshold);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
    } on Exception catch (error) {
      if (!mounted) {
        return;
      }

      final message = error.toString().trim();
      setState(() {
        _isSaving = false;
        _error = message.isNotEmpty
            ? message
            : context.l10n.commonSomethingWentWrong;
      });
    }
  }

  int? _parseThreshold() {
    final value = int.tryParse(_thresholdController.text.trim());
    if (value == null || value < 0) {
      return null;
    }
    return value;
  }
}
