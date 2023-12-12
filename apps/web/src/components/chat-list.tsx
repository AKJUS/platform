import { type Message } from 'ai';
import { Separator } from '@/components/ui/separator';
import { ChatMessage } from '@/components/chat-message';

export interface ChatList {
  title?: string;
  titleLoading?: boolean;
  messages: (Message & { chat_id?: string; created_at?: string })[];
  setInput: (input: string) => void;
  embeddedUrl?: string;
  locale: string;
}

export function ChatList({
  title,
  titleLoading,
  messages,
  setInput,
  embeddedUrl,
  locale,
}: ChatList) {
  if (!messages.length) {
    return null;
  }

  return (
    <div
      className={`relative ${
        embeddedUrl ? 'w-full' : 'mx-auto lg:max-w-4xl xl:max-w-6xl'
      }`}
    >
      {(title || titleLoading) && (
        <>
          <div
            className={`bg-foreground/5 rounded-lg border p-4 text-center text-2xl font-semibold ${
              titleLoading ? 'animate-pulse text-transparent' : ''
            }`}
          >
            {titleLoading ? '...' : title}
          </div>
          <Separator className="my-4 md:mb-8" />
        </>
      )}

      {messages.map((message, index) => (
        <div key={index}>
          <ChatMessage
            message={{ ...message, content: message.content.trim() }}
            setInput={setInput}
            embeddedUrl={embeddedUrl}
            locale={locale}
          />
          {index < messages.length - 1 && (
            <Separator className="my-4 md:my-8" />
          )}
        </div>
      ))}
    </div>
  );
}
