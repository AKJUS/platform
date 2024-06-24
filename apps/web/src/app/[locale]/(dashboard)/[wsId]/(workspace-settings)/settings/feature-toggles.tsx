'use client';

import FeatureToggle from '@/components/cards/FeatureToggle';
import useTranslation from 'next-translate/useTranslation';
import { useState } from 'react';

export default function FeatureToggles() {
  const { t } = useTranslation('sidebar-tabs');

  const [features, setFeatures] = useState<{
    [key: string]: boolean;
  }>({});

  const isFeatureEnabled = (feature: string) => {
    return features?.[feature] ?? false;
  };

  const toggleFeature = (feature: string) => {
    setFeatures((features) => ({
      ...features,
      [feature]: !features[feature],
    }));
  };

  const availableFeatures = [
    'documents',
    'users',
    'healthcare',
    'inventory',
    'finance',
  ];

  return availableFeatures.map((feature) => (
    <FeatureToggle
      key={feature}
      label={t(feature)}
      checked={isFeatureEnabled(feature)}
      onCheck={() => toggleFeature(feature)}
    />
  ));
}
