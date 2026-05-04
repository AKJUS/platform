'use client';

import { Check, Loader2 } from '@tuturuuu/icons';
import { Button } from '@tuturuuu/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@tuturuuu/ui/form';
import { useForm } from '@tuturuuu/ui/hooks/use-form';
import { toast } from '@tuturuuu/ui/hooks/use-toast';
import { Input } from '@tuturuuu/ui/input';
import { zodResolver } from '@tuturuuu/ui/resolvers';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import * as z from 'zod';

interface Props {
  wsId: string;
  defaultName?: string | null;
  defaultValue?: string | null;
  disabled?: boolean;
}

const FormSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/),
});

export default function HandleInput({
  wsId,
  defaultName = '',
  defaultValue = '',
  disabled,
}: Props) {
  const t = useTranslations('ws-settings');
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      handle: defaultValue || '',
    },
  });

  const prevDefault = useRef(defaultValue);
  useEffect(() => {
    if (Object.is(prevDefault.current, defaultValue)) return;
    prevDefault.current = defaultValue;
    form.reset({ handle: defaultValue ?? '' });
  }, [defaultValue]);

  const { isDirty } = form.formState;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setSaving(true);

    const res = await fetch(`/api/workspaces/${wsId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: defaultName,
        handle: data.handle,
      }),
    });

    if (res.ok) {
      toast({
        title: t('handle_updated'),
        description: t('handle_updated_description'),
      });
      router.refresh();
      form.reset({ handle: data.handle.toLowerCase() });
    } else {
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      toast({
        title: t('handle_update_error'),
        description: payload?.message || t('handle_update_error_description'),
      });
    }

    setSaving(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="handle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('handle')}</FormLabel>
              <div className="flex min-w-0 items-center gap-2">
                <FormControl className="min-w-0 flex-1">
                  <Input
                    placeholder={t('handle_placeholder')}
                    disabled={disabled}
                    {...field}
                    onChange={(event) => {
                      field.onChange(event.target.value.toLowerCase());
                    }}
                  />
                </FormControl>
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0"
                  disabled={!isDirty || saving || disabled}
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <FormDescription className="text-xs">
                {t('handle_description')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
