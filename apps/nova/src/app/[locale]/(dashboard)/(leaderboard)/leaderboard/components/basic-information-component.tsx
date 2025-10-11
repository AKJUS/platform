import { Rocket, Sparkles, Star, Trophy, Users, Zap } from '@tuturuuu/icons';
import { Badge } from '@tuturuuu/ui/badge';
import { Card, CardContent } from '@tuturuuu/ui/card';
import { Separator } from '@tuturuuu/ui/separator';
import { formatScore } from '@tuturuuu/utils/nova/scores/calculate';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

export interface BasicInformation {
  currentRank: number;
  topScore: number;
  archiverName: string;
  totalParticipants: number;
}

interface Props {
  basicInfo: BasicInformation;
  selectedChallenge: string;
  selectedChallengeTitle: string;
  teamMode?: boolean;
}
export default function BasicInformationComponent({
  basicInfo,
  selectedChallenge,
  selectedChallengeTitle,
  teamMode = false,
}: Props) {
  const t = useTranslations('nova.leaderboard-page');

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            >
              <Trophy className="mr-2 h-4 w-4 text-yellow-500" />
              {t('badge.competition')}
            </Badge>

            {selectedChallenge !== 'all' && (
              <Badge
                variant="outline"
                className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {selectedChallengeTitle}
              </Badge>
            )}

            <Badge
              variant="outline"
              className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            >
              <Rocket className="mr-2 h-4 w-4" />
              {t('badge.active')}
            </Badge>

            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
            >
              <Zap className="mr-2 h-4 w-4" />
              {t('badge.live')}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            <h1 className="mb-2 bg-linear-to-r from-blue-600 via-blue-700 to-indigo-800 bg-clip-text font-extrabold text-4xl text-transparent tracking-tight dark:from-blue-400 dark:via-blue-500 dark:to-indigo-600">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-muted-foreground dark:text-slate-400">
              {t('description')}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <Card className="relative overflow-hidden bg-white dark:border-slate-800 dark:bg-slate-900/80">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-400 to-blue-600" />
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium text-gray-500 text-sm dark:text-slate-400">
                {t('statistics.position.title')}
              </p>
              <h3 className="font-bold text-2xl text-gray-800 dark:text-slate-100">
                {basicInfo.currentRank > 0
                  ? `#${basicInfo.currentRank}`
                  : t('statistics.position.not-ranked')}
              </h3>
              {basicInfo.currentRank > 0 && (
                <p className="text-gray-500 text-xs dark:text-slate-500">
                  {basicInfo.currentRank <= 10
                    ? t('statistics.position.top-position')
                    : basicInfo.currentRank <= 30
                      ? t('statistics.position.rising-position')
                      : t('statistics.position.normal-position')}
                </p>
              )}
            </div>
            <div className="relative">
              <div className="-z-10 absolute inset-0 rounded-full bg-blue-100 blur-sm dark:bg-blue-500/10" />
              <div className="rounded-full bg-gray-100 p-3 text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                <Trophy className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-white dark:border-slate-800 dark:bg-slate-900/80">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-yellow-400 to-yellow-600" />
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium text-gray-500 text-sm dark:text-slate-400">
                {t('statistics.highest-score.title')}
              </p>
              <h3 className="font-bold text-2xl text-yellow-600 dark:text-yellow-400">
                {formatScore(basicInfo.topScore, 2)}
              </h3>
              <p className="text-gray-500 text-xs dark:text-slate-500">
                {basicInfo.topScore > 0
                  ? `${t('statistics.highest-score.description')} ${basicInfo.archiverName}`
                  : t('statistics.highest-score.no-participant')}
              </p>
            </div>
            <div className="relative">
              <div className="-z-10 absolute inset-0 rounded-full bg-yellow-100 blur-sm dark:bg-yellow-500/10" />
              <div className="rounded-full bg-gray-100 p-3 text-yellow-600 dark:bg-slate-800 dark:text-yellow-400">
                <Star className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-white dark:border-slate-800 dark:bg-slate-900/80">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-indigo-400 to-indigo-600" />
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium text-gray-500 text-sm dark:text-slate-400">
                {teamMode
                  ? t('statistics.total.teams')
                  : t('statistics.total.player')}
              </p>
              <h3 className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">
                {basicInfo.totalParticipants}
              </h3>
              <p className="text-gray-500 text-xs dark:text-slate-500">
                {basicInfo.totalParticipants > 50
                  ? t('statistics.total.heating-up')
                  : t('statistics.total.join-now')}
              </p>
            </div>
            <div className="relative">
              <div className="-z-10 absolute inset-0 rounded-full bg-indigo-100 blur-sm dark:bg-indigo-500/10" />
              <div className="rounded-full bg-gray-100 p-3 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="mt-2 mb-8 border-slate-800" />
    </div>
  );
}
