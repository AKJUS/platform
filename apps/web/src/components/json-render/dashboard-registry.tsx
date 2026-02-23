'use client';

import { defineRegistry, useBoundProp } from '@json-render/react';
import { dashboardCatalog } from '@tuturuuu/ai/tools/json-render-catalog';
import { Button } from '@tuturuuu/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tuturuuu/ui/card';
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';

export const { registry, handlers, executeAction } = defineRegistry(
  dashboardCatalog,
  {
    components: {
      Card: ({ props, children }) => (
        <Card className="my-2 border border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">{props.title}</CardTitle>
            {props.description && (
              <CardDescription>{props.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      ),
      Metric: ({ props }) => (
        <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4 shadow-sm">
          <div className="font-medium text-muted-foreground text-sm">
            {props.title}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-bold text-2xl">{props.value}</div>
            {props.trend && props.trendValue && (
              <div
                className={`font-semibold text-xs ${
                  props.trend === 'up'
                    ? 'text-green-500'
                    : props.trend === 'down'
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                }`}
              >
                {props.trendValue}
              </div>
            )}
          </div>
        </div>
      ),
      Form: ({ props, children }) => (
        <div className="my-4 flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <h3 className="font-semibold text-lg">{props.title}</h3>
            {props.description && (
              <p className="text-muted-foreground text-sm">
                {props.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      ),
      Input: ({ props, bindings }) => {
        const [value, setValue] = useBoundProp<string>(
          '',
          bindings?.value || bindings?.[props.name]
        );
        return (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor={props.name}>{props.label}</Label>
            <Input
              id={props.name}
              type={props.type || 'text'}
              placeholder={props.placeholder}
              required={props.required}
              value={value ?? ''}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        );
      },
      Button: ({ props }) => {
        return (
          <Button
            variant={(props.variant || 'default') as any}
            onClick={(e) => {
              e.preventDefault();
              // In a real app with more complex bindings, this might trigger
              // specific actions, but for a simple generative UI we often don't have
              // full interactive binding generation from the AI yet.
            }}
          >
            {props.label}
          </Button>
        );
      },
    },
    actions: {
      log_transaction: async (params, setState) => {
        if (!params) return;
        setState((prev) => ({ ...prev, submitting: true }));
        try {
          const res = await fetch('/api/v1/finance/transactions', {
            method: 'POST',
            body: JSON.stringify({
              amount: params.amount,
              description: params.description,
              wallet_id: (params as any).walletId,
            }),
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res.ok) {
            throw new Error('Failed to log transaction');
          }

          setState((prev) => ({
            ...prev,
            submitting: false,
            success: true,
            message: 'Transaction logged successfully!',
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            submitting: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      },
    },
  }
);
