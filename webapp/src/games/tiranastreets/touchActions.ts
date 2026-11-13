import type {PointerEvent, MouseEvent} from 'react';

/** Respond to each finger's press; only keyboard activation uses click. */
export function touchAction(run: () => void, enabled = true) {
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      e.preventDefault();
      e.stopPropagation();
      if (enabled && (e.pointerType !== 'mouse' || e.button === 0)) run();
    },
    onClick(e: MouseEvent<HTMLElement>) {
      if (enabled && e.detail === 0) run();
    }
  };
}
