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

    console.log(`Listed files for chat ${chatId}. ${wsId}:`, files);

    if (listError) {
      console.error('Error listing files:', listError);
      return [];
    }

    if (!files || files.length === 0) {
      console.log(`No files found in chat ${chatId}`);
      return [];
    }

    const fileContents: ChatFile[] = [];
    const supabase = await createClient();

    for (const file of files) {
      const fileName = file.name || 'unknown';
      const mediaType =
        file.metadata?.mediaType ||
        file.metadata?.mimetype ||
        'application/octet-stream';
      let content: string | ArrayBuffer;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('workspaces')
        .download(`${storagePath}/${file.name}`);

      if (downloadError) {
        console.error(`Error downloading file ${fileName}:`, downloadError);
        continue;
      }

      if (!fileData) {
        console.error(`No data received for file ${fileName}`);
        continue;
      }

      if (mediaType.startsWith('text/') || mediaType === 'application/json') {
        content = await fileData.text();
      } else {
        content = await fileData.arrayBuffer();
      }

      fileContents.push({
        fileName,
        content,
        mediaType,
      });
    }

    console.log('File contents:', fileContents);
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
  const lastUserMessage = processedMessages[lastUserMessageIndex];

  if (!lastUserMessage) {
    return messages;
  }

  const newContent = addFilesToContent(lastUserMessage.content, chatFiles);

  processedMessages[lastUserMessageIndex] = {
    role: 'user',
    content: newContent,
  };

  if (Array.isArray(newContent) && newContent.length > 0) {
    const lastPart = newContent[newContent.length - 1];
    if (lastPart?.type === 'file') {
      console.log('Last file part:', {
        type: 'file',
        mediaType: lastPart.mediaType,
      });
    }
  }

  console.log('Processed messages:', processedMessages[0]?.content);
  return processedMessages;
}
