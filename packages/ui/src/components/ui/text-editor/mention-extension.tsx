import { Node } from '@tiptap/react';
import {
  Box,
  BriefcaseBusiness,
  Calendar,
  CircleCheck,
  User,
} from '@tuturuuu/ui/icons';
import { getInitials } from '@tuturuuu/utils/name-helper';
import { renderToString } from 'react-dom/server';

interface MentionVisualMeta {
  prefix: string;
  pillClass: string;
  avatarClass: string;
  fallback: string;
  icon?: string;
}

const getMentionVisualMeta = (entityType?: string): MentionVisualMeta => {
  switch (entityType) {
    case 'workspace':
      return {
        prefix: '@',
        pillClass:
          'border-dynamic-orange/40 bg-dynamic-orange/10 text-dynamic-orange',
        avatarClass:
          'border-dynamic-orange/30 bg-dynamic-orange/20 text-dynamic-orange',
        fallback: 'W',
        icon: renderToString(
          <span className="flex h-full w-full items-center justify-center">
            <BriefcaseBusiness className="h-3 w-3" />
          </span>
        ),
      };
    case 'project':
      return {
        prefix: '@',
        pillClass:
          'border-dynamic-cyan/40 bg-dynamic-cyan/10 text-dynamic-cyan',
        avatarClass:
          'border-dynamic-cyan/30 bg-dynamic-cyan/20 text-dynamic-cyan',
        fallback: 'P',
        icon: renderToString(
          <span className="flex h-full w-full items-center justify-center">
            <Box className="h-3 w-3" />
          </span>
        ),
      };
    case 'task':
      return {
        prefix: '#',
        pillClass:
          'border-dynamic-blue/40 bg-dynamic-blue/10 text-dynamic-blue',
        avatarClass:
          'border-dynamic-blue/30 bg-dynamic-blue/20 text-dynamic-blue',
        fallback: '#',
        icon: renderToString(
          <span className="flex h-full w-full items-center justify-center">
            <CircleCheck className="h-3 w-3" />
          </span>
        ),
      };
    case 'date':
      return {
        prefix: '@',
        pillClass:
          'border-dynamic-pink/40 bg-dynamic-pink/10 text-dynamic-pink',
        avatarClass:
          'border-dynamic-pink/30 bg-dynamic-pink/20 text-dynamic-pink',
        fallback: 'D',
        icon: renderToString(
          <span className="flex h-full w-full items-center justify-center">
            <Calendar className="h-3 w-3" />
          </span>
        ),
      };
    case 'external-user':
      return {
        prefix: '@',
        pillClass:
          'border-dynamic-gray/40 bg-dynamic-gray/10 text-dynamic-gray',
        avatarClass:
          'border-dynamic-gray/30 bg-dynamic-gray/20 text-dynamic-gray',
        fallback: '@',
        icon: renderToString(
          <span className="flex h-full w-full items-center justify-center">
            <User className="h-3 w-3" />
          </span>
        ),
      };
    case 'user':
      return {
        prefix: '@',
        pillClass:
          'border-dynamic-green/40 bg-dynamic-green/10 text-dynamic-green',
        avatarClass:
          'border-dynamic-green/30 bg-dynamic-green/20 text-dynamic-green',
        fallback: '@',
        icon: renderToString(
          <span className="flex h-full w-full items-center justify-center">
            <User className="h-3 w-3" />
          </span>
        ),
      };
    default:
      return {
        prefix: '@',
        pillClass: 'border-border bg-muted text-muted-foreground',
        avatarClass: 'border-border bg-muted text-muted-foreground',
        fallback: '@',
      };
  }
};

/**
 * Helper function to update avatar wrapper with appropriate content
 */
const updateAvatarContent = (
  avatarWrapper: HTMLSpanElement,
  entityType: string,
  displayName: string,
  avatarUrl: string | null,
  visuals: MentionVisualMeta
) => {
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = displayName;
    img.className = 'absolute inset-0 h-full w-full object-cover';
    img.referrerPolicy = 'no-referrer';
    avatarWrapper.textContent = '';
    avatarWrapper.appendChild(img);
  } else if (visuals.icon) {
    avatarWrapper.innerHTML = visuals.icon;
  } else {
    avatarWrapper.textContent =
      entityType === 'user' || entityType === 'external-user'
        ? getInitials(displayName) || '??'
        : visuals.fallback;
  }
};

export const Mention = Node.create({
  name: 'mention',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      userId: {
        default: null,
      },
      entityId: {
        default: null,
      },
      entityType: {
        default: 'user',
      },
      displayName: {
        default: null,
      },
      avatarUrl: {
        default: null,
      },
      subtitle: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention="true"]',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          return {
            userId: element.dataset.userId ?? null,
            entityId: element.dataset.entityId ?? null,
            entityType: element.dataset.entityType ?? 'user',
            displayName: element.dataset.displayName ?? null,
            avatarUrl: element.dataset.avatarUrl ?? null,
            subtitle: element.dataset.subtitle ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    const userId = (attrs.userId as string | null) ?? null;
    const entityId = (attrs.entityId as string | null) ?? userId;
    const entityType = (attrs.entityType as string | null) ?? 'user';
    const displayNameRaw = (attrs.displayName as string | null) ?? null;
    const avatarUrl = (attrs.avatarUrl as string | null) ?? null;
    const subtitle = (attrs.subtitle as string | null) ?? null;

    delete attrs.userId;
    delete attrs.entityId;
    delete attrs.entityType;
    delete attrs.displayName;
    delete attrs.avatarUrl;
    delete attrs.subtitle;

    const displayName = (displayNameRaw || 'Member').trim();
    const visuals = getMentionVisualMeta(entityType);
    const initials = getInitials(displayName);
    const fallbackGlyph =
      entityType === 'user' || entityType === 'external-user'
        ? initials
        : visuals.fallback;

    const baseAttributes = {
      'data-mention': 'true',
      'data-user-id': userId ?? '',
      'data-entity-id': entityId ?? '',
      'data-entity-type': entityType,
      'data-display-name': displayName,
      'data-avatar-url': avatarUrl ?? '',
      'data-subtitle': subtitle ?? '',
      class: `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-none transition-colors ${visuals.pillClass}`,
      ...attrs,
    };

    const avatarNode: any = avatarUrl
      ? [
          'span',
          {
            class: `relative -ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center self-center overflow-hidden rounded-full border ${visuals.avatarClass}`,
          },
          [
            'img',
            {
              src: avatarUrl,
              alt: displayName,
              class: 'absolute inset-0 h-full w-full object-cover',
            },
          ],
        ]
      : visuals.icon
        ? [
            'span',
            {
              class: `relative -ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center self-center rounded-full border ${visuals.avatarClass}`,
              innerHTML: visuals.icon,
            },
          ]
        : [
            'span',
            {
              class: `relative -ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center self-center rounded-full border text-[10px] font-semibold uppercase ${visuals.avatarClass}`,
            },
            fallbackGlyph,
          ];

    return [
      'span',
      baseAttributes,
      avatarNode,
      [
        'span',
        { class: 'text-current font-semibold' },
        `${visuals.prefix}${displayName}`,
      ],
    ] as any;
  },

  addNodeView() {
    return ({ node }) => {
      let currentDisplayName =
        (node.attrs.displayName as string | null)?.trim() || 'Member';
      let currentAvatarUrl = node.attrs.avatarUrl as string | null;
      const userId = (node.attrs.userId as string | null) ?? '';
      let currentEntityId = (node.attrs.entityId as string | null) ?? userId;
      let currentEntityType =
        (node.attrs.entityType as string | null) ?? 'user';
      let currentSubtitle = (node.attrs.subtitle as string | null) ?? null;
      let visuals = getMentionVisualMeta(currentEntityType);

      const dom = document.createElement('span');
      dom.setAttribute('data-mention', 'true');
      dom.setAttribute('data-user-id', userId);
      dom.setAttribute('data-display-name', currentDisplayName);
      dom.setAttribute('data-entity-id', currentEntityId ?? '');
      dom.setAttribute('data-entity-type', currentEntityType);
      if (currentAvatarUrl)
        dom.setAttribute('data-avatar-url', currentAvatarUrl);
      if (currentSubtitle) dom.setAttribute('data-subtitle', currentSubtitle);
      dom.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-none transition-colors ${visuals.pillClass}`;
      dom.contentEditable = 'false';
      dom.title = currentSubtitle
        ? `${visuals.prefix}${currentDisplayName} • ${currentSubtitle}`
        : `${visuals.prefix}${currentDisplayName}`;

      const avatarWrapper = document.createElement('span');
      avatarWrapper.className = `relative -ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center self-center overflow-hidden rounded-full border text-[10px] font-semibold uppercase ${visuals.avatarClass}`;

      updateAvatarContent(
        avatarWrapper,
        currentEntityType,
        currentDisplayName,
        currentAvatarUrl,
        visuals
      );

      const label = document.createElement('span');
      label.className = 'text-current font-semibold';
      label.textContent = `${visuals.prefix}${currentDisplayName}`;

      dom.appendChild(avatarWrapper);
      dom.appendChild(label);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mention') return false;
          const nextDisplayName =
            (updatedNode.attrs.displayName as string | null)?.trim() ||
            'Member';
          const nextAvatarUrl = updatedNode.attrs.avatarUrl as string | null;
          const nextEntityId =
            (updatedNode.attrs.entityId as string | null) ??
            (updatedNode.attrs.userId as string | null) ??
            null;
          const nextEntityType =
            (updatedNode.attrs.entityType as string | null) ?? 'user';
          const nextSubtitle =
            (updatedNode.attrs.subtitle as string | null) ?? null;

          if (nextDisplayName !== currentDisplayName) {
            label.textContent = `${visuals.prefix}${nextDisplayName}`;
            dom.setAttribute('data-display-name', nextDisplayName);
            currentDisplayName = nextDisplayName;
            if (!currentAvatarUrl) {
              updateAvatarContent(
                avatarWrapper,
                currentEntityType,
                currentDisplayName,
                null,
                visuals
              );
            }
          }

          if (nextAvatarUrl !== currentAvatarUrl) {
            if (nextAvatarUrl) {
              dom.setAttribute('data-avatar-url', nextAvatarUrl);
            } else {
              dom.removeAttribute('data-avatar-url');
            }
            const nextVisuals = getMentionVisualMeta(nextEntityType);
            updateAvatarContent(
              avatarWrapper,
              nextEntityType,
              nextDisplayName,
              nextAvatarUrl,
              nextVisuals
            );
            currentAvatarUrl = nextAvatarUrl;
          }

          if (nextEntityType !== currentEntityType) {
            currentEntityType = nextEntityType;
            visuals = getMentionVisualMeta(currentEntityType);
            dom.setAttribute('data-entity-type', currentEntityType);
            dom.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-none transition-colors ${visuals.pillClass}`;
            avatarWrapper.className = `relative -ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center self-center overflow-hidden rounded-full border text-[10px] font-semibold uppercase ${visuals.avatarClass}`;
            label.textContent = `${visuals.prefix}${currentDisplayName}`;
            if (!currentAvatarUrl) {
              updateAvatarContent(
                avatarWrapper,
                currentEntityType,
                currentDisplayName,
                null,
                visuals
              );
            }
            dom.title = currentSubtitle
              ? `${visuals.prefix}${currentDisplayName} • ${currentSubtitle}`
              : `${visuals.prefix}${currentDisplayName}`;
          }

          if (nextEntityId !== currentEntityId && nextEntityId !== null) {
            currentEntityId = nextEntityId;
            dom.setAttribute('data-entity-id', currentEntityId ?? '');
          }

          if (nextSubtitle !== currentSubtitle) {
            currentSubtitle = nextSubtitle;
            if (currentSubtitle) {
              dom.setAttribute('data-subtitle', currentSubtitle);
            } else {
              dom.removeAttribute('data-subtitle');
            }
            dom.title = currentSubtitle
              ? `${visuals.prefix}${currentDisplayName} • ${currentSubtitle}`
              : `${visuals.prefix}${currentDisplayName}`;
          }

          return true;
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});
