import type { Metadata } from 'next';
import { siteConfig } from '@/constants/configs';
import BrandingClient from './branding-client';

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

const metadataByLocale = {
  en: {
    title: 'Tuturuuu brand guidelines and assets',
    description:
      'Download Tuturuuu brand assets, product marks, colors, typography guidance, and usage rules for consistent brand applications.',
    keywords: [
      'Tuturuuu brand guidelines',
      'Tuturuuu logo',
      'Tuturuuu brand assets',
      'Mira AI logo',
      'Tuturuuu media kit',
    ],
    openGraphAlt: 'Tuturuuu brand guidelines and asset library',
  },
  vi: {
    title: 'Bộ nhận diện và tài nguyên thương hiệu Tuturuuu',
    description:
      'Tải tài nguyên thương hiệu Tuturuuu, logo sản phẩm, bảng màu, quy chuẩn chữ và hướng dẫn sử dụng nhất quán.',
    keywords: [
      'bộ nhận diện Tuturuuu',
      'logo Tuturuuu',
      'tài nguyên thương hiệu Tuturuuu',
      'logo Mira AI',
      'media kit Tuturuuu',
    ],
    openGraphAlt: 'Bộ nhận diện và thư viện tài nguyên thương hiệu Tuturuuu',
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const normalizedLocale = locale === 'vi' ? 'vi' : 'en';
  const copy = metadataByLocale[normalizedLocale];
  const pageUrl = `${siteConfig.url}/${normalizedLocale}/branding`;
  const openGraphImageUrl = `${pageUrl}/opengraph-image`;
  const twitterImageUrl = `${pageUrl}/twitter-image`;

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteConfig.url}/en/branding`,
        vi: `${siteConfig.url}/vi/branding`,
      },
    },
    keywords: [...copy.keywords],
    authors: [{ name: 'Tuturuuu Team' }],
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: copy.title,
      description: copy.description,
      siteName: siteConfig.name,
      locale: normalizedLocale === 'vi' ? 'vi_VN' : 'en_US',
      images: [
        {
          url: openGraphImageUrl,
          width: 1200,
          height: 630,
          alt: copy.openGraphAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      images: [twitterImageUrl],
      creator: '@tuturuuu',
    },
  };
}

export default function BrandingPage() {
  return <BrandingClient />;
}
