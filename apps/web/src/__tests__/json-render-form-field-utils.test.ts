import { describe, expect, it } from 'vitest';
import {
  deriveFormFieldName,
  normalizeTextControlValue,
} from '@/components/json-render/form-field-utils';

describe('json-render form field utils', () => {
  it('derives a stable field name from label when name is missing', () => {
    expect(
      deriveFormFieldName(undefined, 'What are your favorite hobbies?')
    ).toBe('what_are_your_favorite_hobbies');
  });

  it('prefers explicit field name when provided', () => {
    expect(deriveFormFieldName('hobbies', 'Ignored Label')).toBe('hobbies');
  });

  it('normalizes object values to empty string instead of [object Object]', () => {
    expect(normalizeTextControlValue({ foo: 'bar' })).toBe('');
  });

  it('normalizes primitive and array values to editable text', () => {
    expect(normalizeTextControlValue(42)).toBe('42');
    expect(normalizeTextControlValue(true)).toBe('true');
    expect(normalizeTextControlValue(['alpha', 2, true])).toBe(
      'alpha, 2, true'
    );
  });
});
