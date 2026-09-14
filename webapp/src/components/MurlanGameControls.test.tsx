import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MurlanGameControls from './MurlanGameControls';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('Murlan mobile game controls', () => {
  let root: Root;
  let container: HTMLDivElement;
  let props: React.ComponentProps<typeof MurlanGameControls>;

  const button = (label: string) => {
    const match = Array.from(container.querySelectorAll('button')).find((node) =>
      node.getAttribute('aria-label') === label || node.textContent === label
    );
    if (!match) throw new Error(`Button not found: ${label}`);
    return match;
  };

  const render = async (changes = {}) => {
    props = { ...props, ...changes };
    await act(async () => root.render(<MurlanGameControls {...props} />));
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    props = {
      humanTurn: true,
      activePlayerName: 'You',
      selectedCount: 0,
      cardsLeft: 14,
      canPass: false,
      message: 'Choose cards including 3♠.',
      muted: false,
      configOpen: false,
      onConfigChange: vi.fn(),
      onChat: vi.fn(),
      onGift: vi.fn(),
      onInfo: vi.fn(),
      onToggleMute: vi.fn(),
      onPass: vi.fn(),
      onClear: vi.fn(),
      onPlay: vi.fn(),
      children: <button type="button">Emerald table</button>
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps opening pass and empty selection actions disabled, then enables a selected play', async () => {
    await render();
    expect(button('Pass').disabled).toBe(true);
    expect(button('Clear selected cards').disabled).toBe(true);
    expect(button('Play selected cards').disabled).toBe(true);
    expect(container.textContent).toContain('Choose cards including 3♠.');
    await render({ selectedCount: 2, canPass: true });
    expect(button('Pass').disabled).toBe(false);
    expect(button('Clear selected cards').disabled).toBe(false);
    expect(button('Play 2 selected cards').disabled).toBe(false);
    await act(async () => {
      button('Play 2 selected cards').click();
      button('Clear selected cards').click();
      button('Pass').click();
    });
    expect(props.onPlay).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(props.onPass).toHaveBeenCalledTimes(1);
  });

  it('blocks play and pass during an opponent turn while allowing selection clearing', async () => {
    await render({ humanTurn: false, activePlayerName: 'Lina', selectedCount: 1, canPass: true });
    expect(button('Pass').disabled).toBe(true);
    expect(button('Play 1 selected card').disabled).toBe(true);
    expect(button('Clear selected cards').disabled).toBe(false);
    expect(container.textContent).toContain('Lina’s turn');
  });

  it('exposes table state and invalid-combination feedback visibly and to assistive technology', async () => {
    await render({ actionError: 'This combo does not beat the one on the table.', tableSummary: 'Lina: Pair 7♠ 7♥' });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(props.actionError);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('Lina: Pair 7♠ 7♥');
    await render({ actionError: '' });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('connects every utility control and reflects mute state', async () => {
    await render();
    await act(async () => {
      button('Table settings').click();
      button('Quick chat').click();
      button('Send a gift').click();
      button('Game rules').click();
      button('Mute game sound').click();
    });
    expect(props.onConfigChange).toHaveBeenCalledWith(true);
    for (const callback of [props.onChat, props.onGift, props.onInfo, props.onToggleMute]) {
      expect(callback).toHaveBeenCalledTimes(1);
    }
    await render({ muted: true });
    expect(button('Unmute game sound').getAttribute('aria-pressed')).toBe('true');
  });

  it('focuses settings, contains keyboard navigation, closes with Escape, and restores focus', async () => {
    await render({ configOpen: true });
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(button('Close settings'));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(button('Emerald table'));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(button('Close settings'));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(props.onConfigChange).toHaveBeenCalledWith(false);
    await render({ configOpen: false });
    expect(document.activeElement).toBe(button('Table settings'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
