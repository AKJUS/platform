'use client';

import GetStartedButton from '../get-started-button';
import GradientHeadline from '../gradient-headline';
import { getFeatures } from './features';
import { Card } from '@repo/ui/components/ui/card';
import { motion } from 'framer-motion';
import { Rocket, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Separator } from '@repo/ui/components/ui/separator';

function MarketingPage() {
  const t = useTranslations();
  const features = getFeatures(t);
  const isBrowser = typeof window !== 'undefined';

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const rainingElements = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    content: i % 3 === 0 ? '✨' : i % 3 === 1 ? '🌟' : '❄️',
    color: i % 2 === 0 ? 'text-blue-400' : 'text-pink-400',
  }));

  return (
    <div className="from-deep-blue via-midnight-blue to-dark-purple relative flex h-full w-full flex-col items-center bg-gradient-to-b">
      {/* Raining Effect */}
      <div className="absolute h-screen inset-0 overflow-hidden">
        {rainingElements.map((element) => (
          <motion.div
            key={element.id}
            initial={{
              x: isBrowser ? Math.random() * window.innerWidth : 0,
              y: -50,
            }}
            animate={{
              y: [
                Math.random() * -200,
                Math.random() * (isBrowser ? window.innerHeight : 500),
              ],
              opacity: [0, 1, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: Math.random() * 10 + 5,
              delay: Math.random() * 5,
            }}
            className={`absolute text-sm text-white text-opacity-50 ${element.color}`}
            style={{
              left: `${Math.random() * 100}%`,
              fontSize: `${Math.random() * 1.5 + 0.5}rem`,
            }}
          >
            {element.content}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-48 pt-[250px]"
      >
        <h1 className="text-center text-4xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">
          JOIN OUR PLAYGROUND
        </h1>
        <h2 className="text-gradient mt-4 text-center text-lg font-bold md:text-2xl lg:text-3xl">
          <GradientHeadline title={'Get ready for future, get used with AI'} />
        </h2>
        <p className="mt-4 text-center text-gray-400">
          Practice your prompt, use your prompt in real-world applications.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="relative">
            <input className="ease placeholder:text-white-400 hover:border-white-300 peer rounded-xl border border-slate-200 bg-white bg-opacity-20 px-4 py-2 text-white shadow-sm backdrop-blur-lg transition duration-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-80" />
            <label className="absolute left-2.5 top-2.5 origin-left transform cursor-text px-1 text-sm text-white transition-all peer-focus:-top-2 peer-focus:left-2.5 peer-focus:scale-90 peer-focus:text-xs peer-focus:text-white">
              Prompt here..
            </label>
          </div>

          <GetStartedButton href="/login" />
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute inset-x-0 bottom-24 flex w-full flex-col items-center"
      >
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            ↓
          </motion.div>
        </div>
      </motion.div>
      <Separator className="bg-foreground/5 mb-8" />
      <motion.section
        id="features"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={containerVariants}
        className="from-midnight-blue pt-16 via-midnight-blue to-dark-purple w-full bg-gradient-to-b py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-4xl font-bold text-white">
            {('common.features')}
            <span className="ml-2 inline-block">
              <Zap className="h-8 w-8 text-blue-400" />
            </span>
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="row-span-2 md:col-span-2 shadow-sm backdrop-blur-lg duration-300 lg:col-span-2">
              <div
                className="flex h-full border-black flex-col backdrop-blur-lg rounded-lg p-8"
                style={{ backgroundColor: '#1E2240' }}
              >
                {features?.[0]?.icon}
                <h3 className="mb-4 text-2xl font-bold text-white">
                  {features?.[0]?.title}
                </h3>
                <p className="text-white">{features?.[0]?.subtitle}</p>
                {features?.[0]?.url && (
                  <Link
                    href={features[0].url}
                    className="mt-auto inline-flex items-center gap-2 pt-4 text-white hover:underline"
                  >
                    {('common.learn_more')}
                    <Rocket className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </Card>

            {features.slice(1).map((feature, i) => (
              <Card
                key={i}
                className="group relative shadow-sm backdrop-blur-lg duration-300 overflow-hidden rounded-lg transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className="flex h-full backdrop-blur-lg flex-col p-6"
                  style={{ backgroundColor: '#1E2240' }} // Dark blue background
                >
                  <div className="mb-4 text-white">{feature.icon}</div>
                  <h3 className="mb-2 text-xl font-bold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-white">{feature.subtitle}</p>
                  {feature.url && (
                    <Link
                      href={feature.url}
                      className="mt-auto inline-flex items-center gap-2 pt-4 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {('common.learn_more')}
                      <Rocket className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default MarketingPage;
