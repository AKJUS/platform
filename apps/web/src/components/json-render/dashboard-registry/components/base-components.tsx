'use client';

import { useActions, useStateBinding, useStateStore } from '@json-render/react';
import * as Icons from '@tuturuuu/icons';
import type {
  JsonRenderBadgeProps,
  JsonRenderBarChartProps,
  JsonRenderButtonProps,
  JsonRenderCalloutProps,
  JsonRenderCardProps,
  JsonRenderComponentContext,
  JsonRenderGridProps,
  JsonRenderIconProps,
  JsonRenderListItemProps,
  JsonRenderMetricProps,
  JsonRenderProgressProps,
  JsonRenderSeparatorProps,
  JsonRenderStackProps,
  JsonRenderTabsProps,
  JsonRenderTextProps,
} from '@tuturuuu/types';
import { Avatar, AvatarFallback, AvatarImage } from '@tuturuuu/ui/avatar';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tuturuuu/ui/card';
import { getIconComponentByKey } from '@tuturuuu/ui/custom/icon-picker';
import { Progress } from '@tuturuuu/ui/progress';
import { Separator } from '@tuturuuu/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tuturuuu/ui/tabs';
import { cn } from '@tuturuuu/utils/format';
import { type ComponentType, createElement } from 'react';
import { dispatchUiAction } from '../../action-dispatch';
import {
  isStructuredSubmitAction,
  resolveActionHandlerMap,
} from '../../action-routing';
import type { IconProps, StatDisplayProps } from '../shared';

type IconComponent = ComponentType<IconProps>;

const iconRegistry = Icons as unknown as Record<
  string,
  IconComponent | undefined
>;

function resolveRegistryIcon(name?: string): IconComponent | null {
  if (!name) return null;
  return getIconComponentByKey(name) ?? iconRegistry[name] ?? null;
}

type LegacyTextProps = JsonRenderTextProps;
type LegacyCalloutProps = JsonRenderCalloutProps;

export const dashboardBaseComponents = {
  Card: ({
    props,
    children,
  }: JsonRenderComponentContext<JsonRenderCardProps>) => {
    const hasContent =
      children && Array.isArray(children) && children.length > 0;
    return (
      <Card className="my-2 min-w-0 overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
        {(props.title || props.description) && (
          <CardHeader className="gap-1 border-border/30 border-b bg-muted/15 px-5 py-4 text-left">
            {props.title && (
              <CardTitle className="break-words font-semibold text-[15px] leading-tight">
                {props.title}
              </CardTitle>
            )}
            {props.description && (
              <CardDescription className="break-words text-[13px]">
                {props.description}
              </CardDescription>
            )}
          </CardHeader>
        )}
        {hasContent && (
          <CardContent
            className={cn(
              'min-w-0 px-5 py-4',
              !props.title && !props.description && 'pt-5'
            )}
          >
            {children}
          </CardContent>
        )}
      </Card>
    );
  },
  Stack: ({
    props,
    children,
  }: JsonRenderComponentContext<JsonRenderStackProps>) => (
    <div
      className={cn(
        'flex min-w-0 [&>*]:min-w-0',
        props.direction === 'horizontal' ? 'flex-row' : 'flex-col',
        props.align === 'start' && 'items-start',
        props.align === 'center' && 'items-center',
        props.align === 'end' && 'items-end',
        props.align === 'stretch' && 'items-stretch',
        props.justify === 'start' && 'justify-start',
        props.justify === 'center' && 'justify-center',
        props.justify === 'end' && 'justify-end',
        props.justify === 'between' && 'justify-between',
        props.justify === 'around' && 'justify-around'
      )}
      style={{ gap: props.gap ? `${props.gap}px` : '1rem' }}
    >
      {children}
    </div>
  ),
  Grid: ({
    props,
    children,
  }: JsonRenderComponentContext<JsonRenderGridProps>) => (
    <div
      className="grid w-full min-w-0 [&>*]:min-w-0"
      style={{
        gridTemplateColumns: `repeat(${props.cols || 1}, minmax(0, 1fr))`,
        gap: props.gap ? `${props.gap}px` : '1rem',
      }}
    >
      {children}
    </div>
  ),
  Text: ({ props }: JsonRenderComponentContext<LegacyTextProps>) => {
    const tagMap: Record<string, keyof HTMLElementTagNameMap> = {
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      h4: 'h4',
      p: 'p',
      small: 'small',
      tiny: 'span',
    };
    const variant = props.variant ?? 'p';
    const componentTag = tagMap[variant] ?? 'p';
    const isBody = !props.variant || variant === 'p';
    return createElement(
      componentTag,
      {
        className: cn(
          isBody && 'text-[14px] leading-relaxed',
          variant === 'h1' && 'font-bold text-2xl tracking-tight',
          variant === 'h2' && 'font-semibold text-xl tracking-tight',
          variant === 'h3' && 'font-semibold text-lg',
          variant === 'h4' && 'font-medium text-[15px]',
          variant === 'small' && 'text-[13px] leading-normal',
          variant === 'tiny' && 'text-xs leading-normal',
          props.weight === 'normal' && 'font-normal',
          props.weight === 'medium' && 'font-medium',
          props.weight === 'semibold' && 'font-semibold',
          props.weight === 'bold' && 'font-bold',
          !props.color && isBody && 'text-foreground/90',
          props.color === 'muted' && 'text-muted-foreground',
          props.color === 'primary' && 'text-primary',
          props.color === 'success' && 'text-dynamic-green',
          props.color === 'warning' && 'text-dynamic-yellow',
          props.color === 'error' && 'text-dynamic-red',
          props.align === 'center' && 'text-center',
          props.align === 'right' && 'text-right',
          'whitespace-pre-wrap break-words'
        ),
      },
      props.content ?? props.text
    );
  },
  Icon: ({ props }: JsonRenderComponentContext<JsonRenderIconProps>) => {
    const IconComp = resolveRegistryIcon(props.name);
    if (!IconComp) return null;
    const size = props.size || 18;
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2 text-primary"
        style={props.color ? { color: props.color } : undefined}
      >
        <IconComp size={size} strokeWidth={1.75} />
      </span>
    );
  },
  Badge: ({ props }: JsonRenderComponentContext<JsonRenderBadgeProps>) => (
    <Badge variant={props.variant || 'default'}>{props.label}</Badge>
  ),
  Avatar: ({
    props,
  }: JsonRenderComponentContext<{
    src?: string;
    fallback?: string;
    size?: number;
  }>) => (
    <Avatar style={{ width: props.size || 32, height: props.size || 32 }}>
      {props.src && <AvatarImage src={props.src} />}
      <AvatarFallback>{props.fallback || '?'}</AvatarFallback>
    </Avatar>
  ),
  Separator: ({
    props,
  }: JsonRenderComponentContext<JsonRenderSeparatorProps>) => (
    <Separator orientation={props.orientation || 'horizontal'} />
  ),
  Callout: ({ props }: JsonRenderComponentContext<LegacyCalloutProps>) => {
    const variant = props.variant || 'info';
    const variantStyles: Record<
      string,
      { bg: string; border: string; text: string; icon: string }
    > = {
      info: {
        bg: 'bg-primary/5',
        border: 'border-primary/20',
        text: 'text-primary',
        icon: 'Info',
      },
      success: {
        bg: 'bg-dynamic-green/5',
        border: 'border-dynamic-green/20',
        text: 'text-dynamic-green',
        icon: 'CheckCircle',
      },
      warning: {
        bg: 'bg-dynamic-yellow/5',
        border: 'border-dynamic-yellow/20',
        text: 'text-dynamic-yellow',
        icon: 'AlertTriangle',
      },
      error: {
        bg: 'bg-dynamic-red/5',
        border: 'border-dynamic-red/20',
        text: 'text-dynamic-red',
        icon: 'XCircle',
      },
    };
    const style = variantStyles[variant] || variantStyles.info!;
    const CalloutIcon = resolveRegistryIcon(style.icon);
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4',
          style.bg,
          style.border
        )}
      >
        {CalloutIcon && (
          <CalloutIcon className={cn('mt-0.5 h-4 w-4 shrink-0', style.text)} />
        )}
        <div className="min-w-0 flex-1">
          {props.title && (
            <div
              className={cn(
                'mb-0.5 break-words font-semibold text-sm',
                style.text
              )}
            >
              {props.title}
            </div>
          )}
          <div className="whitespace-pre-wrap break-words text-[13px] text-foreground/80 leading-relaxed">
            {props.content ?? props.text}
          </div>
        </div>
      </div>
    );
  },
  ListItem: ({
    props,
  }: JsonRenderComponentContext<JsonRenderListItemProps>) => {
    const actions = useActions();
    const IconComp = resolveRegistryIcon(props.icon);
    return (
      <button
        type="button"
        className={cn(
          'flex w-full min-w-0 items-start gap-3 rounded-lg px-1 py-1.5 text-left transition-colors',
          props.action && 'cursor-pointer hover:bg-muted/10 active:bg-muted/20'
        )}
        onClick={() => {
          if (!props.action) return;
          dispatchUiAction(actions, props.action, {
            id: props.action,
            label: props.title,
            source: 'list-item',
          });
        }}
        aria-label={props.title}
      >
        {IconComp && (
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2 text-primary"
            style={
              props.iconColor
                ? {
                    backgroundColor: `${props.iconColor}1a`,
                    color: props.iconColor,
                  }
                : {}
            }
          >
            <IconComp size={16} strokeWidth={1.75} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="whitespace-normal break-words font-medium text-[14px] leading-tight">
            {props.title}
          </span>
          {props.subtitle && (
            <span className="whitespace-normal break-words text-[12px] text-muted-foreground leading-tight">
              {props.subtitle}
            </span>
          )}
        </div>
        {props.trailing && (
          <span className="max-w-[45%] whitespace-normal break-words font-medium text-[13px] text-muted-foreground leading-tight">
            {props.trailing}
          </span>
        )}
      </button>
    );
  },
  Progress: ({
    props,
  }: JsonRenderComponentContext<JsonRenderProgressProps>) => {
    const resolveColor = () => {
      if (props.color && props.color !== 'default') return props.color;
      if (props.value > 66) return 'success';
      if (props.value > 33) return 'warning';
      return 'error';
    };
    const color = resolveColor();
    const colorClasses: Record<string, string> = {
      success: '[&>div]:bg-dynamic-green',
      warning: '[&>div]:bg-dynamic-yellow',
      error: '[&>div]:bg-dynamic-red',
    };
    return (
      <div className="flex w-full flex-col gap-1.5">
        {(props.label || props.showValue) && (
          <div className="flex items-center justify-between text-xs">
            {props.label && (
              <span className="font-medium text-foreground/70">
                {props.label}
              </span>
            )}
            {props.showValue && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {Math.round(props.value)}%
              </span>
            )}
          </div>
        )}
        <Progress
          value={props.value}
          className={cn('h-2 rounded-full', colorClasses[color])}
        />
      </div>
    );
  },
  Metric: ({ props }: JsonRenderComponentContext<JsonRenderMetricProps>) => {
    const trend = props.trend;
    const trendValue = props.trendValue;
    const showTrend = trend && trend !== 'neutral';

    return (
      <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/70 p-4 text-left shadow-sm backdrop-blur-sm">
        <div className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          {props.title}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="font-bold text-2xl tracking-tighter">
            {props.value}
          </div>
          {showTrend && (
            <div
              className={cn(
                'flex items-center gap-0.5 font-semibold text-[13px]',
                trend === 'up' ? 'text-dynamic-green' : 'text-dynamic-red'
              )}
            >
              {trend === 'up' ? '↑' : '↓'}
              {trendValue}
            </div>
          )}
          {trend === 'neutral' && trendValue && (
            <div className="font-medium text-[13px] text-muted-foreground">
              {trendValue}
            </div>
          )}
        </div>
      </div>
    );
  },
  Stat: ({ props }: JsonRenderComponentContext<StatDisplayProps>) => {
    const p = props as StatDisplayProps;
    const IconComp = resolveRegistryIcon(p.icon);
    const colorClass =
      p.variant === 'success'
        ? 'text-dynamic-green'
        : p.variant === 'warning'
          ? 'text-dynamic-yellow'
          : p.variant === 'error'
            ? 'text-dynamic-red'
            : 'text-foreground';
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/5 px-2.5 py-1.5 transition-colors hover:bg-muted/10">
        {IconComp && (
          <IconComp
            size={14}
            className={cn(
              'shrink-0',
              p.variant ? colorClass : 'text-muted-foreground'
            )}
          />
        )}
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide">
            {p.label}
          </span>
          <span
            className={cn('font-semibold text-sm tracking-tight', colorClass)}
          >
            {p.value}
          </span>
        </div>
      </div>
    );
  },
  Tabs: ({
    props,
    children,
  }: JsonRenderComponentContext<JsonRenderTabsProps>) => {
    const [activeTab, setActiveTab] = useStateBinding<string>('activeTab');
    const currentTab =
      activeTab ?? props.defaultTab ?? props.tabs?.[0]?.id ?? '';

    return (
      <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className="mb-4 grid w-full"
          style={{
            gridTemplateColumns: `repeat(${props.tabs?.length || 1}, 1fr)`,
          }}
        >
          {props.tabs?.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {props.tabs?.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {children}
          </TabsContent>
        ))}
      </Tabs>
    );
  },
  Button: ({ props }: JsonRenderComponentContext<JsonRenderButtonProps>) => {
    const actions = useActions();
    const { state } = useStateStore();
    const IconComp = props.icon ? resolveRegistryIcon(props.icon) : null;
    return (
      <Button
        variant={props.variant || 'default'}
        size={props.size || 'default'}
        className="h-auto w-full whitespace-normal break-words"
        onClick={() => {
          if (!props.action) return;

          const handlerMap = resolveActionHandlerMap(actions);
          const directHandler = handlerMap[props.action];
          if (typeof directHandler === 'function') {
            void Promise.resolve(directHandler());
            return;
          }

          if (isStructuredSubmitAction(props.action)) {
            const submitFormHandler = handlerMap.submit_form;
            if (typeof submitFormHandler === 'function') {
              void Promise.resolve(
                submitFormHandler({
                  title: props.label || 'Form Submission',
                  values: state,
                  actionId: props.action,
                })
              );
              return;
            }
          }

          dispatchUiAction(actions, props.action, {
            id: props.action,
            label: props.label,
            source: 'button',
          });
        }}
      >
        {IconComp && (
          <IconComp
            className={cn('inline-block', props.label ? 'mr-2' : '')}
            size={16}
          />
        )}
        {props.label}
      </Button>
    );
  },
  BarChart: ({
    props,
  }: JsonRenderComponentContext<JsonRenderBarChartProps>) => {
    const maxValue = Math.max(...(props.data?.map((d) => d.value) || [100]));

    const resolveBarColor = (color?: string): string | undefined => {
      if (!color) return undefined;
      const normalized = String(color).toLowerCase();
      const tokenMap: Record<string, string> = {
        success: 'var(--color-dynamic-green)',
        warning: 'var(--color-dynamic-yellow)',
        error: 'var(--color-dynamic-red)',
        'dynamic-green': 'var(--color-dynamic-green)',
        'dynamic-yellow': 'var(--color-dynamic-yellow)',
        'dynamic-red': 'var(--color-dynamic-red)',
        green: 'var(--color-dynamic-green)',
        blue: 'var(--color-dynamic-blue)',
        orange: 'var(--color-dynamic-orange)',
        purple: 'var(--color-dynamic-purple)',
        cyan: 'var(--color-dynamic-cyan)',
        pink: 'var(--color-dynamic-pink)',
      };
      return tokenMap[normalized] ?? color;
    };

    return (
      <div className="flex w-full flex-col gap-4 py-2">
        <div
          className="flex items-end justify-between gap-2 px-1"
          style={{ height: props.height || 120 }}
        >
          {props.data?.map((item, i: number) => {
            const barColor = resolveBarColor(item.color);
            return (
              <div
                key={i}
                className="group relative flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all duration-500 group-hover:opacity-80',
                    barColor ? '' : 'bg-primary/80'
                  )}
                  style={{
                    height: `${(item.value / maxValue) * 100}%`,
                    ...(barColor ? { backgroundColor: barColor } : {}),
                  }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white transition-all group-hover:scale-100">
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between gap-1 px-1">
          {props.data?.map((item, i: number) => (
            <div
              key={i}
              className="flex-1 whitespace-normal break-words text-center text-[10px] text-muted-foreground uppercase leading-tight tracking-tight"
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    );
  },
};
