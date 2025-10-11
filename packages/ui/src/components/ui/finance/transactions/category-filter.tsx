'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Tag, X } from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/client';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@tuturuuu/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@tuturuuu/ui/popover';
import { cn } from '@tuturuuu/utils/format';
import { useState } from 'react';

interface TransactionCategory {
  id: string;
  name: string;
  is_expense: boolean;
}

interface CategoryFilterProps {
  wsId: string;
  selectedCategoryIds: string[];
  onCategoriesChange: (categoryIds: string[]) => void;
  className?: string;
}

// Function to fetch transaction categories
async function fetchTransactionCategories(
  wsId: string
): Promise<TransactionCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transaction_categories')
    .select('id, name, is_expense')
    .eq('ws_id', wsId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map((cat) => ({
    ...cat,
    is_expense: cat.is_expense ?? false,
  }));
}

export function CategoryFilter({
  wsId,
  selectedCategoryIds,
  onCategoriesChange,
  className,
}: CategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = selectedCategoryIds.length > 0;

  // Use React Query to fetch and cache transaction categories
  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['transaction-categories', wsId],
    queryFn: () => fetchTransactionCategories(wsId),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    enabled: !!wsId, // Only run query if wsId is provided
  });

  const handleCategoryToggle = (categoryId: string) => {
    const newSelectedCategoryIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];

    onCategoriesChange(newSelectedCategoryIds);
  };

  const clearAllFilters = () => {
    onCategoriesChange([]);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Category Filter Dropdown */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Tag className="h-3 w-3" />
            <span className="text-xs">Filter by categories</span>
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 rounded-full px-1.5 text-xs"
              >
                {selectedCategoryIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Loading categories...' : 'No categories found.'}
              </CommandEmpty>

              {error && (
                <CommandGroup>
                  <CommandItem disabled className="text-destructive">
                    {error instanceof Error
                      ? error.message
                      : 'Failed to load categories'}
                  </CommandItem>
                </CommandGroup>
              )}

              {!isLoading && !error && categories.length > 0 && (
                <CommandGroup>
                  {categories
                    .sort((a, b) => {
                      // Sort selected categories to the top
                      const aSelected = selectedCategoryIds.includes(a.id);
                      const bSelected = selectedCategoryIds.includes(b.id);

                      if (aSelected && !bSelected) return -1;
                      if (!aSelected && bSelected) return 1;

                      // For categories with the same selection status, sort by name
                      return a.name.localeCompare(b.name);
                    })
                    .map((category) => {
                      const isSelected = selectedCategoryIds.includes(
                        category.id
                      );

                      return (
                        <CommandItem
                          key={category.id}
                          onSelect={() => handleCategoryToggle(category.id)}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <div
                            className={cn(
                              'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50 [&_svg]:invisible'
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </div>
                          <div className="flex flex-1 items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-1 flex-col">
                              <span className="font-medium text-sm">
                                {category.name}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {category.is_expense ? 'Expense' : 'Income'}
                              </span>
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              )}

              {hasActiveFilters && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={clearAllFilters}
                      className="cursor-pointer justify-center text-center text-destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear all filters
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
