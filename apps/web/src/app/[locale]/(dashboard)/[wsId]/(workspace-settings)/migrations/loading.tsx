import useTranslation from 'next-translate/useTranslation';

export default function Loading() {
  const { t } = useTranslation('common');

  return (
    <div className="flex items-center justify-center p-8 font-semibold">
      {t('loading')}...
    </div>
  );
}
