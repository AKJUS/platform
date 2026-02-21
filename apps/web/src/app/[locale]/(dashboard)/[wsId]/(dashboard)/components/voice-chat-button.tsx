'use client';

import { useState } from 'react';
import { VoiceChatMode } from '../../mira/components/voice/voice-chat-mode';

interface VoiceChatButtonProps {
  wsId: string;
}

export default function VoiceChatButton({ wsId }: VoiceChatButtonProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <VoiceChatMode
      wsId={wsId}
      isOpen={isActive}
      onClose={() => setIsActive(false)}
    />
  );
}

export function useVoiceChatToggle() {
  const [voiceActive, setVoiceActive] = useState(false);
  return {
    voiceActive,
    toggleVoice: () => setVoiceActive((prev) => !prev),
    closeVoice: () => setVoiceActive(false),
  };
}
