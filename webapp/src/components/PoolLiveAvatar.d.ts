import type { Context, ImgHTMLAttributes, ReactElement } from 'react';
export type RoyalAvatarCall = {
  previewOnly: boolean;
  canStart: boolean;
  startVideo: () => void;
};
export const PoolLiveAvatarContext: Context<RoyalAvatarCall | null>;
export default function PoolLiveAvatar(props: ImgHTMLAttributes<HTMLImageElement> & {
  seat: 'self' | 'opponent';
  visible?: boolean;
}): ReactElement;
