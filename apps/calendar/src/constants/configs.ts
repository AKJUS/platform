import { DEV_MODE } from './common';

export const siteConfig = {
  name: 'Tuturuuu Calendar',
  url: DEV_MODE ? 'http://localhost:3001' : 'https://calendar.tuturuuu.com',
  ogImage: DEV_MODE
    ? 'http://localhost:3001/api/og'
    : 'https://calendar.tuturuuu.com/api/og',
  links: {
    twitter: 'https://twitter.com/tutur3u',
    github: 'https://github.com/tutur3u/platform',
  },
};

export interface AppConfig {
  readonly openai: {
    apiKey: string;
    baseURL?: string;
  };
  readonly google: {
    apiKey: string;
    baseURL?: string;
  };
  anthropic: {
    apiKey: string;
    baseURL?: string;
  };
  readonly vertex: {
    project?: string;
    location?: string;
    email?: string;
    clientId?: string;
    privateKey?: string;
    privateKeyId?: string;
    credentials?: string;
  };
  readonly defaultModel: string;
}

export const appConfig: AppConfig = {
  openai: {
    // baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  google: {
    // baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  },
  anthropic: {
    // baseURL: process.env.ANTHROPIC_BASE_URL,
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  vertex: {
    project: process.env.GOOGLE_VERTEX_PROJECT,
    location: process.env.GOOGLE_VERTEX_LOCATION,
    email: process.env.GOOGLE_VERTEX_EMAIL,
    clientId: process.env.GOOGLE_VERTEX_CLIENT_ID,
    privateKey: process.env.GOOGLE_VERTEX_PRIVATE_KEY,
    privateKeyId: process.env.GOOGLE_VERTEX_PRIVATE_KEY_ID,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  defaultModel: process.env.DEFAULT_AI_MODEL || 'gemini-2.5-flash',
};
