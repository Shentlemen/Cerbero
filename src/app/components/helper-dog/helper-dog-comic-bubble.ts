export type ComicBubbleKind = 'tickets' | 'ocs';

export interface ComicBubblePayload {
  kind: ComicBubbleKind;
  title: string;
  text: string;
  firstLogin: boolean;
  anchoredByBadge: boolean;
}

export const COMIC_BUBBLE_KIND_PRIORITY: Record<ComicBubbleKind, number> = {
  tickets: 0,
  ocs: 1
};
