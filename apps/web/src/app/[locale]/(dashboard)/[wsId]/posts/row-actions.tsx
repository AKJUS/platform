import type { PostEmail } from './types';
import {
  isOptimisticallyLoading,
  isOptimisticallySent,
  markAsOptimisticallyLoading,
  markAsOptimisticallySent,
  removeFromOptimisticLoading,
  useOptimisticLoadingEmails,
  useOptimisticSentEmails,
} from './use-posts';
import useEmail from '@/hooks/useEmail';
import { Button } from '@tuturuuu/ui/button';
import { LoadingIndicator } from '@tuturuuu/ui/custom/loading-indicator';
import { CircleAlert, CircleSlash, MailCheck, Send } from '@tuturuuu/ui/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export default function PostsRowActions({
  data,
  onEmailSent,
}: {
  data: PostEmail;
  onEmailSent?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { sendEmail, localLoading, localError, localSuccess } = useEmail();
  const [optimisticSentEmails, setOptimisticSentEmails] =
    useOptimisticSentEmails();
  const [optimisticLoadingEmails, setOptimisticLoadingEmails] =
    useOptimisticLoadingEmails();

  const sendable =
    !!data.email &&
    !!data.ws_id &&
    !!data.user_id &&
    !!data.post_id &&
    !!data.group_id &&
    !!data.group_name &&
    !!data.post_title &&
    !!data.post_content &&
    !!data?.is_completed;

  // Check if email is sent (either from server data or optimistically)
  const isSent =
    !!data.email_id || isOptimisticallySent(data, optimisticSentEmails);
  // Check if email is loading (either from local state or optimistically)
  const isLoading =
    localLoading || isOptimisticallyLoading(data, optimisticLoadingEmails);

  const handleSendEmail = async () => {
    // The local loading, error, and success states are now managed by useEmail hook

    if (
      !!data.email &&
      !!data.ws_id &&
      !!data.user_id &&
      !!data.post_id &&
      !!data.group_id &&
      !!data.group_name &&
      !!data.post_title &&
      !!data.post_content &&
      !!data?.is_completed
    ) {
      // Mark as optimistically loading immediately
      markAsOptimisticallyLoading(
        data,
        optimisticLoadingEmails,
        setOptimisticLoadingEmails
      );

      const success = await sendEmail({
        wsId: data.ws_id,
        postId: data.post_id,
        groupId: data.group_id,
        post: {
          id: data.post_id,
          title: data.post_title,
          content: data.post_content,
          notes: data.notes || '',
          group_name: data.group_name,
          created_at:
            dayjs(data.post_created_at || data.created_at)?.toISOString() ||
            undefined,
        },
        users: [
          {
            id: data.user_id,
            email: data.email,
            username: data.recipient || data.email || '<Chưa có tên>',
            notes: data?.notes || '',
            is_completed: data?.is_completed,
          },
        ],
      });

      // Remove from optimistic loading
      removeFromOptimisticLoading(
        data,
        optimisticLoadingEmails,
        setOptimisticLoadingEmails
      );

      // Only mark as optimistically sent if the email was sent successfully
      if (success) {
        markAsOptimisticallySent(
          data,
          optimisticSentEmails,
          setOptimisticSentEmails
        );
      }

      if (onEmailSent) onEmailSent();
      // Always refresh router after sending email
      router.refresh();
    }
  };

  return (
    <div className="flex flex-none items-center justify-end gap-2">
      <Button
        size="xs"
        onClick={handleSendEmail}
        disabled={
          !!localError ||
          isLoading ||
          !data.email ||
          isSent ||
          !sendable ||
          data.email.includes('@easy') ||
          localSuccess
        }
        variant={
          localError
            ? 'destructive'
            : isLoading
              ? 'secondary'
              : localSuccess || isSent
                ? 'outline'
                : undefined
        }
        className="flex min-w-[90px] items-center gap-2"
      >
        {data?.email?.includes('@easy') ? (
          <CircleSlash className="h-4 w-4" />
        ) : isLoading ? (
          <>
            <LoadingIndicator />
            <span>{t('post-email-data-table.sending')}</span>
          </>
        ) : localError ? (
          <>
            <CircleAlert className="h-4 w-4" />
            <span>{t('post-email-data-table.error')}</span>
          </>
        ) : localSuccess || isSent ? (
          <>
            <MailCheck className="h-4 w-4" />
            <span>{t('post-email-data-table.sent')}</span>
          </>
        ) : (
          <>
            <Send className="mr-1.5 h-4 w-4" />
            {t('post-email-data-table.send_email')}
          </>
        )}
      </Button>
    </div>
  );
}
