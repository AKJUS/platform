import {
  createClient,
  createDynamicClient,
} from '@tuturuuu/supabase/next/server';
import type { FilePart, ImagePart, ModelMessage, TextPart } from 'ai';

type ChatFile = {
  fileName: string;
  content: string | ArrayBuffer;
  mediaType: string;
};

function maskIdentifier(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function getAllChatFiles(
  wsId: string,
  chatId: string
): Promise<ChatFile[]> {
  try {
    const sbDynamic = await createDynamicClient();

    const storagePath = `${wsId}/chats/ai/resources/${chatId}`;
    const { data: files, error: listError } = await sbDynamic.storage
      .from('workspaces')
      .list(storagePath, {
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (listError) {
      console.error('Error listing files:', listError);
      return [];
    }

    console.info('[Google Chat Files] listed chat files', {
      wsId: maskIdentifier(wsId),
      chatId: maskIdentifier(chatId),
      fileCount: files?.length ?? 0,
    });

    if (!files || files.length === 0) {
      return [];
    }

    const supabase = await createClient();
    const fileContents = (
      await Promise.all(
        files.map(async (file) => {
          const fileName = file.name || 'unknown';
          const mediaType =
            file.metadata?.mediaType ||
            file.metadata?.mimetype ||
            'application/octet-stream';

          const { data: fileData, error: downloadError } =
            await supabase.storage
              .from('workspaces')
              .download(`${storagePath}/${file.name}`);

          if (downloadError) {
            console.error(`Error downloading file ${fileName}:`, downloadError);
            return null;
          }

          if (!fileData) {
            console.error(`No data received for file ${fileName}`);
            return null;
          }

          const content =
            mediaType.startsWith('text/') || mediaType === 'application/json'
              ? await fileData.text()
              : await fileData.arrayBuffer();

          return {
            fileName,
            content,
            mediaType,
          } satisfies ChatFile;
        })
      )
    ).filter((file): file is ChatFile => file !== null);

    return fileContents;
  } catch (error) {
    console.error('Error getting all chat files:', error);
    return [];
  }
}

function addFilesToContent(
  existingContent: ModelMessage['content'],
  chatFiles: ChatFile[]
): Array<TextPart | ImagePart | FilePart> {
  const contentParts: Array<TextPart | ImagePart | FilePart> = [];
  const supportedFileMediaTypes = new Set([
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'text/markdown',
  ]);

  if (typeof existingContent === 'string') {
    contentParts.push({ type: 'text', text: existingContent });
  } else if (Array.isArray(existingContent)) {
    for (const part of existingContent) {
      if (
        part.type === 'text' ||
        part.type === 'image' ||
        part.type === 'file'
      ) {
        contentParts.push(part);
      }
    }
  }

  for (const file of chatFiles) {
    const { content, mediaType, fileName } = file;

    if (mediaType.startsWith('image/')) {
      const imagePart: ImagePart = {
        type: 'image',
        image:
          content instanceof ArrayBuffer ? new Uint8Array(content) : content,
        mediaType,
      };
      contentParts.push(imagePart);
    } else if (
      supportedFileMediaTypes.has(mediaType) &&
      content instanceof ArrayBuffer &&
      content.byteLength > 0
    ) {
      const filePart: FilePart = {
        type: 'file',
        data: new Uint8Array(content),
        mediaType,
      };
      contentParts.push(filePart);
    } else if (
      supportedFileMediaTypes.has(mediaType) &&
      typeof content === 'string'
    ) {
      const filePart: FilePart = {
        type: 'file',
        data: new TextEncoder().encode(content),
        mediaType,
      };
      contentParts.push(filePart);
    } else {
      contentParts.push({
        type: 'text',
        text: `Attachment available: ${fileName} (${mediaType}). This format cannot be passed directly to the model. Use convert_file_to_markdown with fileName "${fileName}" if you need to read it.`,
      });
    }
  }

  return contentParts;
}

export async function processMessagesWithFiles(
  messages: ModelMessage[],
  wsId: string,
  chatId: string
): Promise<ModelMessage[]> {
  const chatFiles = await getAllChatFiles(wsId, chatId);
  if (chatFiles.length === 0) {
    return messages;
  }

  let lastUserMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && message.role === 'user') {
      lastUserMessageIndex = i;
      break;
    }
  }

  if (lastUserMessageIndex === -1) {
    return messages;
  }

  const processedMessages = [...messages];
  const lastUserMessage = processedMessages[lastUserMessageIndex]!;
  const newContent = addFilesToContent(lastUserMessage.content, chatFiles);

  processedMessages[lastUserMessageIndex] = {
    role: 'user',
    content: newContent,
  };

  if (Array.isArray(newContent) && newContent.length > 0) {
    const lastPart = newContent[newContent.length - 1];
    if (lastPart?.type === 'file') {
      console.info('[Google Chat Files] appended file part metadata', {
        type: 'file',
        mediaType: lastPart.mediaType,
      });
    }
  }

  return processedMessages;
}
