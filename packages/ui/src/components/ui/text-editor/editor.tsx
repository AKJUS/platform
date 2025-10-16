'use client';

import type { QueryClient } from '@tanstack/react-query';
import {
  type Editor,
  EditorContent,
  type JSONContent,
  useEditor,
} from '@tiptap/react';
import type { TaskList } from '@tuturuuu/types/primitives/TaskList';
import type SupabaseProvider from '@tuturuuu/ui/hooks/supabase-provider';
import { toast } from '@tuturuuu/ui/sonner';
import { debounce } from 'lodash';
import { TextSelection } from 'prosemirror-state';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { getEditorExtensions } from './extensions';
import { ToolBar } from './tool-bar';

const hasContent = (node: JSONContent): boolean => {
  // Check for text content
  if (node.text && node.text.trim().length > 0) return true;

  // Check for media content (images, videos, YouTube embeds, tables, etc.)
  if (
    node.type &&
    ['image', 'imageResize', 'youtube', 'video', 'mention', 'table'].includes(
      node.type
    )
  ) {
    return true;
  }

  // Recursively check children
  if (node.content && node.content.length > 0) {
    return node.content.some((child: JSONContent) => hasContent(child));
  }

  // Empty paragraphs or empty doc should return false
  return false;
};

interface RichTextEditorProps {
  content: JSONContent | null;
  onChange?: (content: JSONContent | null) => void;
  readOnly?: boolean;
  titlePlaceholder?: string;
  writePlaceholder?: string;
  saveButtonLabel?: string;
  savedButtonLabel?: string;
  className?: string;
  workspaceId?: string;
  onImageUpload?: (file: File) => Promise<string>;
  flushPendingRef?: React.MutableRefObject<
    (() => JSONContent | null) | undefined
  >;
  onArrowUp?: (cursorOffset?: number) => void;
  onArrowLeft?: () => void;
  editorRef?: React.MutableRefObject<any>;
  initialCursorOffset?: number | null;
  onEditorReady?: (editor: Editor) => void;
  yjsDoc?: Y.Doc | null;
  yjsProvider?: SupabaseProvider | null;
  boardId?: string;
  availableLists?: TaskList[];
  queryClient?: QueryClient;
  allowCollaboration?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  readOnly = false,
  titlePlaceholder = 'What is the title?',
  writePlaceholder = 'Write something...',
  saveButtonLabel,
  savedButtonLabel,
  className,
  workspaceId,
  onImageUpload,
  flushPendingRef,
  onArrowUp,
  onArrowLeft,
  editorRef: externalEditorRef,
  initialCursorOffset,
  onEditorReady,
  boardId,
  availableLists,
  queryClient,
  yjsDoc = null,
  yjsProvider = null,
  allowCollaboration = false,
}: RichTextEditorProps) {
  const [isUploadingPastedImage, setIsUploadingPastedImage] = useState(false);

  // Use refs to ensure we have stable references for handlers
  const onImageUploadRef = useRef(onImageUpload);
  const workspaceIdRef = useRef(workspaceId);
  const onChangeRef = useRef(onChange);
  const onArrowUpRef = useRef(onArrowUp);
  const onArrowLeftRef = useRef(onArrowLeft);
  const debouncedOnChangeRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
    workspaceIdRef.current = workspaceId;
    onChangeRef.current = onChange;
    onArrowUpRef.current = onArrowUp;
    onArrowLeftRef.current = onArrowLeft;
  }, [onImageUpload, workspaceId, onChange, onArrowUp, onArrowLeft]);

  const debouncedOnChange = useMemo(
    () =>
      debounce((newContent: JSONContent) => {
        onChangeRef.current?.(hasContent(newContent) ? newContent : null);
      }, 500),
    []
  );

  // Store debounced function ref for flushing
  useEffect(() => {
    debouncedOnChangeRef.current = debouncedOnChange;
  }, [debouncedOnChange]);

  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  const getEditorClasses = useMemo(() => {
    const baseClasses = [
      'border border-dynamic-border rounded-md bg-transparent',
      'max-w-none overflow-y-auto pt-4',
      // Typography base
      'text-foreground leading-relaxed',
      // First child margin reset
      '[&_:first-child]:mt-0',
      // Headings
      '[&_h1]:text-4xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-6 [&_h1]:mb-4',
      '[&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-5 [&_h2]:mb-3',
      '[&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2',
      '[&_h4]:text-xl [&_h4]:font-semibold [&_h4]:text-foreground [&_h4]:mt-3 [&_h4]:mb-2',
      '[&_h5]:text-lg [&_h5]:font-semibold [&_h5]:text-foreground [&_h5]:mt-3 [&_h5]:mb-2',
      '[&_h6]:text-base [&_h6]:font-semibold [&_h6]:text-foreground [&_h6]:mt-3 [&_h6]:mb-2',
      // Paragraphs
      '[&_p]:my-3 [&_p]:leading-7',
      // Lists - general styling
      '[&_ul]:my-3 [&_ul]:ml-6 [&_ul]:px-4 [&_ul]:mr-[0.4rem]',
      '[&_ol]:my-3 [&_ol]:ml-6 [&_ol]:px-4 [&_ol]:mr-[0.4rem]',
      '[&_li]:my-1 [&_li]:leading-7',
      '[&_ul_li_p]:my-1',
      '[&_ol_li_p]:my-1',
      '[&_li_h1]:text-4xl [&_li_h2]:text-3xl [&_li_h3]:text-2xl',
      // Task list specific styles
      '[&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:ml-6 [&_ul[data-type="taskList"]]:pl-0 [&_ul[data-type="taskList"]]:pr-4 [&_ul[data-type="taskList"]]:mr-[0.4rem] [&_ul[data-type="taskList"]]:my-3',
      '[&_ul[data-type="taskList"]_li]:flex [&_ul[data-type="taskList"]_li]:items-start [&_ul[data-type="taskList"]_li]:my-1',
      '[&_ul[data-type="taskList"]_li>label]:flex-[0_0_auto] [&_ul[data-type="taskList"]_li>label]:mr-2 [&_ul[data-type="taskList"]_li>label]:select-none [&_ul[data-type="taskList"]_li>label]:pt-[0.453rem]',
      '[&_ul[data-type="taskList"]_li>div]:flex-1 [&_ul[data-type="taskList"]_li>div]:min-w-0',
      '[&_ul[data-type="taskList"]_li_p]:my-1',
      // Checkbox styling
      '[&_ul[data-type="taskList"]_input[type="checkbox"]]:appearance-none [&_ul[data-type="taskList"]_input[type="checkbox"]]:h-[18px] [&_ul[data-type="taskList"]_input[type="checkbox"]]:w-[18px]',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]]:cursor-pointer [&_ul[data-type="taskList"]_input[type="checkbox"]]:rounded-[4px] [&_ul[data-type="taskList"]_input[type="checkbox"]]:border-2 [&_ul[data-type="taskList"]_input[type="checkbox"]]:border-input',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]]:bg-background [&_ul[data-type="taskList"]_input[type="checkbox"]]:transition-all [&_ul[data-type="taskList"]_input[type="checkbox"]]:duration-150',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]]:shrink-0',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]:hover]:border-dynamic-gray [&_ul[data-type="taskList"]_input[type="checkbox"]:hover]:bg-dynamic-gray/10 [&_ul[data-type="taskList"]_input[type="checkbox"]:hover]:scale-105',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]:focus]:outline-none [&_ul[data-type="taskList"]_input[type="checkbox"]:focus]:ring-2 [&_ul[data-type="taskList"]_input[type="checkbox"]:focus]:ring-dynamic-gray/30 [&_ul[data-type="taskList"]_input[type="checkbox"]:focus]:ring-offset-2 [&_ul[data-type="taskList"]_input[type="checkbox"]:focus]:border-dynamic-gray',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:bg-dynamic-gray/20 [&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:border-dynamic-gray',
      '[&_ul[data-type="taskList"]_input[type="checkbox"]:checked:hover]:bg-dynamic-gray/10 [&_ul[data-type="taskList"]_input[type="checkbox"]:checked:hover]:border-dynamic-gray',
      // Light mode checkmark (dark/black)
      `[&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22%2309090b%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M4%208l2.5%202.5L12%205%22%2F%3E%3C%2Fsvg%3E')]`,
      // Dark mode checkmark (white)
      `dark:[&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M4%208l2.5%202.5L12%205%22%2F%3E%3C%2Fsvg%3E')]`,
      '[&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:bg-center [&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:bg-no-repeat [&_ul[data-type="taskList"]_input[type="checkbox"]:checked]:bg-[length:14px_14px]',
      // Nested task lists
      '[&_ul[data-type="taskList"]_ul[data-type="taskList"]]:my-0 [&_ul[data-type="taskList"]_ul[data-type="taskList"]]:ml-0',
      // Blockquotes
      '[&_blockquote]:border-l-4 [&_blockquote]:border-dynamic-border [&_blockquote]:pl-4 [&_blockquote]:my-4',
      '[&_blockquote]:text-muted-foreground [&_blockquote]:italic',
      // Code
      '[&_code]:text-dynamic-pink [&_code]:bg-dynamic-pink/10 [&_code]:px-1.5 [&_code]:py-0.5',
      '[&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
      '[&_pre]:bg-dynamic-border/50 [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:my-4 [&_pre]:overflow-x-auto',
      '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground',
      // Strong/Bold
      '[&_strong]:font-bold [&_strong]:text-foreground',
      '[&_b]:font-bold [&_b]:text-foreground',
      // Emphasis/Italic
      '[&_em]:italic [&_em]:text-foreground',
      '[&_i]:italic [&_i]:text-foreground',
      // Links (ensure they maintain cyan color even when bold)
      '[&_a]:text-dynamic-cyan [&_a]:underline [&_a]:cursor-pointer',
      '[&_a:hover]:text-dynamic-cyan/80',
      '[&_a_strong]:text-dynamic-cyan [&_a_b]:text-dynamic-cyan',
      '[&_strong_a]:text-dynamic-cyan [&_b_a]:text-dynamic-cyan',
      // Horizontal rule
      '[&_hr]:border-dynamic-border [&_hr]:my-8',
      // Tables - Enhanced styling for better UX
      '[&_table]:my-6 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-collapse [&_table]:border-dynamic-border',
      '[&_table]:shadow-sm',
      // Table headers
      '[&_th]:relative [&_th]:border-r [&_th]:border-dynamic-border [&_th]:bg-dynamic-border/30',
      '[&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground',
      '[&_th]:last:border-r-0 [&_th_p]:my-0',
      // Table rows
      '[&_tr]:border-b [&_tr]:border-dynamic-border [&_tr]:last:border-0',
      '[&_tr]:transition-colors [&_tr:hover]:bg-dynamic-surface/30',
      // Table cells
      '[&_td]:relative [&_td]:border-r [&_td]:border-dynamic-border [&_td]:px-4 [&_td]:py-3',
      '[&_td]:last:border-r-0 [&_td_p]:my-0',
      '[&_td]:transition-colors [&_td:hover]:bg-dynamic-surface/50',
      '[&_td:focus]:bg-dynamic-surface/70 [&_td:focus]:outline-none',
      '[&_td:focus]:ring-2 [&_td:focus]:ring-dynamic-blue/50 [&_td:focus]:ring-inset',
      // Selected cells/rows
      '[&_.selectedCell]:bg-dynamic-blue/10 [&_.selectedCell]:ring-2 [&_.selectedCell]:ring-dynamic-blue/30',
      // Column resize handle
      '[&_.column-resize-handle]:absolute [&_.column-resize-handle]:right-[-2px] [&_.column-resize-handle]:top-0',
      '[&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:cursor-col-resize',
      '[&_.column-resize-handle]:bg-dynamic-blue/50 [&_.column-resize-handle]:opacity-0',
      '[&_.column-resize-handle:hover]:opacity-100 [&_.column-resize-handle]:transition-opacity',
      // Placeholder styles
      '[&_*:is(p,h1,h2,h3).is-empty::before]:content-[attr(data-placeholder)]',
      '[&_*:is(p,h1,h2,h3).is-empty::before]:text-muted-foreground',
      '[&_*:is(p,h1,h2,h3).is-empty::before]:float-left',
      '[&_*:is(p,h1,h2,h3).is-empty::before]:h-0',
      '[&_*:is(p,h1,h2,h3).is-empty::before]:pointer-events-none',
      className,
    ].filter(Boolean);
    return baseClasses.join(' ');
  }, [className]);

  const editor = useEditor({
    extensions: getEditorExtensions({
      titlePlaceholder,
      writePlaceholder,
      doc: allowCollaboration && yjsDoc ? yjsDoc : undefined,
      provider: allowCollaboration && yjsProvider ? yjsProvider : undefined,
    }),
    content: allowCollaboration ? undefined : content,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: getEditorClasses,
      },
      handleKeyDown: (view, event) => {
        // Prevent Ctrl+Enter / Cmd+Enter from creating a new line
        // Let the parent component handle the save action
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          return true;
        }

        const { state, dispatch } = view;
        const { selection } = state;
        const { $from } = selection;

        // Handle Backspace
        if (event.key === 'Backspace' && onArrowUpRef.current) {
          console.log('Backspace at pos:', $from.pos);

          // Check if we're on the first line
          const coordsAtCursor = view.coordsAtPos($from.pos);
          const coordsAtStart = view.coordsAtPos(1);
          const isOnFirstLine =
            coordsAtCursor &&
            coordsAtStart &&
            Math.abs(coordsAtCursor.top - coordsAtStart.top) < 5;

          console.log('Is on first line:', isOnFirstLine);

          if (isOnFirstLine) {
            const firstChild = state.doc.firstChild;
            console.log('First child:', {
              type: firstChild?.type.name,
              text: firstChild?.textContent,
              isEmpty: firstChild?.textContent.trim() === '',
              nodeSize: firstChild?.nodeSize,
            });

            // If cursor is at the absolute start (position 1)
            if ($from.pos === 1) {
              const firstChild = state.doc.firstChild;

              // If first line is empty and there's a second line, delete the empty line
              if (firstChild && firstChild.textContent.trim() === '') {
                const secondChild = state.doc.maybeChild(1);
                if (secondChild) {
                  console.log(
                    'Empty first line - manually deleting via commands'
                  );
                  event.preventDefault();

                  // Use commands to delete the node
                  const tr = state.tr;
                  const nodeSize = firstChild.nodeSize;

                  // Delete from position 0 to end of first child (including the node itself)
                  tr.delete(0, nodeSize);

                  // Dispatch and trigger onChange manually
                  dispatch(tr);

                  // Manually trigger onChange since we're in handleKeyDown
                  if (!readOnly && onChangeRef.current) {
                    const newJson = tr.doc.toJSON();
                    onChangeRef.current(hasContent(newJson) ? newJson : null);
                  }

                  return true;
                }
              }

              // If first line is NOT empty, go to title
              console.log('Non-empty first line - going to title');
              event.preventDefault();
              onArrowUpRef.current();
              return true;
            }
          }
        }

        // Handle ArrowUp when on the first line
        if (event.key === 'ArrowUp' && onArrowUpRef.current) {
          // Try to resolve a position one line up by checking textBetween
          // If we're at the very start of the document (pos 1), go to title
          if ($from.pos === 1) {
            event.preventDefault();
            onArrowUpRef.current(0); // At the start, offset is 0
            return true;
          }

          // Check if we're in a position where up arrow won't move us
          // This happens when we're on the first line of the first block
          const coordsAtCursor = view.coordsAtPos($from.pos);
          const coordsAtStart = view.coordsAtPos(1);

          // If cursor is on the same line as the start, go to title
          if (
            coordsAtCursor &&
            coordsAtStart &&
            Math.abs(coordsAtCursor.top - coordsAtStart.top) < 5
          ) {
            event.preventDefault();

            // Calculate character offset from start of the first line
            // Position 1 is the start of the document, $from.pos is current cursor
            // Since we're on the first line, the offset is simply the distance from position 1
            const offset = $from.pos - 1;

            onArrowUpRef.current(offset);
            return true;
          }
        }

        // Handle ArrowLeft when at the very start of the document
        if (event.key === 'ArrowLeft' && onArrowLeftRef.current) {
          // If we're at position 1 (start of document), go back to title
          if ($from.pos === 1) {
            event.preventDefault();
            onArrowLeftRef.current();
            return true;
          }
        }

        return false;
      },
      handlePaste: (view, event) => {
        // Handle image and video paste
        const items = event.clipboardData?.items;
        if (!items || !onImageUploadRef.current || !workspaceIdRef.current)
          return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;

          // Debug: Log the MIME type to console
          console.log('Pasted item type:', item.type);

          const isImage = item.type.startsWith('image/');
          const isVideo = item.type.startsWith('video/');

          if (isImage || isVideo) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;

            console.log('Detected file:', {
              name: file.name,
              type: file.type,
              size: file.size,
              isImage,
              isVideo,
            });

            // Validate file size (max 50MB for videos, 5MB for images)
            const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
            if (file.size > maxSize) {
              toast.error(
                isVideo
                  ? 'Video size must be less than 50MB'
                  : 'Image size must be less than 5MB'
              );
              return true;
            }

            // Upload file asynchronously
            setIsUploadingPastedImage(true);
            onImageUploadRef
              .current(file)
              .then((url) => {
                const { state } = view;
                const { from } = state.selection;

                if (isImage) {
                  // ImageResize extension uses 'imageResize' node name
                  const imageNode =
                    state.schema.nodes.imageResize || state.schema.nodes.image;
                  if (imageNode) {
                    const transaction = state.tr.insert(
                      from,
                      imageNode.create({ src: url })
                    );
                    view.dispatch(transaction);
                    toast.success('Image uploaded successfully');
                  } else {
                    console.error(
                      'Available nodes:',
                      Object.keys(state.schema.nodes)
                    );
                    toast.error('Image node not found');
                  }
                } else if (isVideo) {
                  // Video node
                  const videoNode = state.schema.nodes.video;
                  if (videoNode) {
                    const transaction = state.tr.insert(
                      from,
                      videoNode.create({ src: url })
                    );
                    view.dispatch(transaction);
                    toast.success('Video uploaded successfully');
                  } else {
                    console.error(
                      'Available nodes:',
                      Object.keys(state.schema.nodes)
                    );
                    toast.error('Video node not found');
                  }
                }
              })
              .catch((error) => {
                console.error('Failed to upload pasted file:', error);
                toast.error(
                  `Failed to upload ${isVideo ? 'video' : 'image'}. Please try again.`
                );
              })
              .finally(() => {
                setIsUploadingPastedImage(false);
              });

            return true;
          }
        }
        return false;
      },
    },
    onCreate: ({ editor }) => {
      if (externalEditorRef) {
        externalEditorRef.current = editor;
      }
      onEditorReady?.(editor);
    },
    onUpdate: ({ editor }) => {
      // Don't call onChange when using collaboration - Yjs doc is the source of truth
      if (!readOnly && !allowCollaboration) {
        debouncedOnChange(editor.getJSON());
      }
    },
  });

  // Update editor's editable state when readOnly prop changes
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Update editor content when the content prop changes externally
  useEffect(() => {
    if (!editor || allowCollaboration) return;

    const currentContent = editor.getJSON();
    const contentChanged =
      JSON.stringify(currentContent) !== JSON.stringify(content);

    if (contentChanged) {
      // Update editor content without triggering onChange
      editor.commands.setContent(content || { type: 'doc', content: [] }, {
        emitUpdate: false,
      });
    }
  }, [editor, content, allowCollaboration]);

  // Handle initial cursor positioning when focusing from title
  useEffect(() => {
    if (
      editor &&
      initialCursorOffset !== null &&
      initialCursorOffset !== undefined
    ) {
      // Use requestAnimationFrame to ensure editor is fully ready
      requestAnimationFrame(() => {
        try {
          const doc = editor.state.doc;
          const firstNode = doc.firstChild;

          if (firstNode) {
            // Calculate position: 1 (start of doc) + offset within first line
            // Cap it at the length of the first text node
            const firstTextLength = firstNode.textContent.length;
            const actualOffset = Math.min(initialCursorOffset, firstTextLength);
            const newPos = Math.max(
              1,
              Math.min(1 + actualOffset, doc.content.size - 1)
            );

            // Create a text selection at the target position
            const tr = editor.state.tr.setSelection(
              TextSelection.near(doc.resolve(newPos))
            );
            editor.view.dispatch(tr);
          }
        } catch (error) {
          console.error('Error setting cursor position:', error);
        }
      });
    }
  }, [editor, initialCursorOffset]);

  // Expose flush method via ref - returns current content
  useEffect(() => {
    if (!flushPendingRef || !editor) return;

    flushPendingRef.current = () => {
      // When using collaboration, don't flush to local state - Yjs doc is the source
      if (allowCollaboration) {
        return null;
      }

      // Flush pending debounced changes immediately
      if (debouncedOnChangeRef.current) {
        debouncedOnChangeRef.current.flush();
      }
      // Get current editor content
      const currentContent = editor.getJSON();
      const finalContent = hasContent(currentContent) ? currentContent : null;

      // Also call onChange to update parent state
      onChangeRef.current?.(finalContent);

      // Return the content so caller can use it immediately
      return finalContent;
    };
  }, [editor, flushPendingRef, allowCollaboration]);

  return (
    <div className="group relative h-full">
      {!readOnly && (
        <ToolBar
          editor={editor}
          saveButtonLabel={saveButtonLabel}
          savedButtonLabel={savedButtonLabel}
          workspaceId={workspaceId}
          onImageUpload={onImageUpload}
          boardId={boardId}
          availableLists={availableLists}
          queryClient={queryClient}
        />
      )}
      <EditorContent editor={editor} className="h-full" />
      {isUploadingPastedImage && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-dynamic-orange border-t-transparent" />
            <span className="text-sm">Uploading media...</span>
          </div>
        </div>
      )}
    </div>
  );
}
