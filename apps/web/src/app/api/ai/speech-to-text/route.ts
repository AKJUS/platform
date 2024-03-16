import { NextRequest, NextResponse } from 'next/server';

async function run(model: string, input: { [key: string]: any }) {
  const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const API_TOKEN = process.env.CF_API_TOKEN;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
    {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  const result = await response.json();
  return result;
}

export async function GET(_: NextRequest) {
  const audio = await fetch(
    'https://github.com/Azure-Samples/cognitive-services-speech-sdk/raw/master/samples/cpp/windows/console/samples/enrollment_audio_katie.wav'
  );
  const blob = await audio.arrayBuffer();

  const response = await run('@cf/openai/whisper', {
    audio: [...new Uint8Array(blob)],
  });

  console.log(JSON.stringify(response));
  return NextResponse.json({ message: response });
}
