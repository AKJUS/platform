'use client';

import { useNavigation } from './shared/navigation-config';
import { Badge } from '@tuturuuu/ui/badge';
import { Card } from '@tuturuuu/ui/card';
import { BookText } from '@tuturuuu/ui/icons';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@tuturuuu/ui/navigation-menu';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function MainNavigationMenu() {
  const t = useTranslations();
  const { categories } = useNavigation(t);

  const main = categories.find((cat) => cat.title === 'main')?.items || [];
  const resources =
    categories.find((cat) => cat.title === 'resources')?.items || [];
  const company =
    categories.find((cat) => cat.title === 'company')?.items || [];

  return (
    <NavigationMenu className="flex w-full max-w-none">
      <NavigationMenuList className="flex w-full justify-between">
        {main.map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              href={item.href}
              className={cn(
                navigationMenuTriggerStyle(),
                'bg-linear-to-r bg-transparent px-6 font-semibold transition-all duration-300 hover:bg-background/30'
              )}
            >
              {item.label}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}

        <NavigationMenuItem>
          <NavigationMenuTrigger className="group bg-linear-to-r bg-transparent font-semibold transition-all duration-300 hover:bg-background/30">
            {t('common.resources')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 bg-linear-to-br from-background via-background/95 to-background/90 p-6 backdrop-blur-sm md:w-[500px] md:grid-cols-2 lg:w-[800px]">
              <Card className="col-span-full mb-2 bg-primary/5 p-4">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <BookText className="h-4 w-4" />
                  <span>Learning Resources</span>
                </div>
              </Card>
              {resources.map((resource) => (
                <ListItem
                  key={resource.href}
                  title={resource.label}
                  href={resource.href}
                  icon={resource.icon}
                >
                  {resource.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {company.map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              href={item.href}
              className={cn(
                navigationMenuTriggerStyle(),
                'bg-linear-to-r bg-transparent px-6 font-semibold transition-all duration-300 hover:bg-background/30'
              )}
            >
              <span className="flex items-center gap-2">{item.label}</span>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ComponentRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & {
    title: string;
    icon: React.ReactNode;
    badge?: string;
    disabled?: boolean;
  }
>(({ className, title, icon, badge, disabled, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'group relative block h-full select-none space-y-1 rounded-md p-4 leading-none no-underline outline-hidden transition-all duration-300',
            'via-primary/10 to-primary/5 hover:bg-linear-to-br',
            'opacity-90 hover:opacity-100',
            'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
          {...props}
        >
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="text-primary transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110">
                {icon}
              </div>
              <div className="font-semibold text-sm leading-none">{title}</div>
              {badge && (
                <Badge
                  variant="secondary"
                  className="ml-auto flex-none animate-pulse text-xs"
                >
                  {badge}
                </Badge>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-muted-foreground text-sm leading-snug opacity-80 transition-opacity duration-300 group-hover:opacity-100">
              {children}
            </p>
          </div>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
