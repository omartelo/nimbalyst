/**
 * RichTranscriptView - edit-last-user-message affordance gating
 *
 * Covers the pencil button that lets the user edit and re-send the tail user
 * prompt before the model replies (PR #503), and the sync gate that disables
 * it (PR #503 follow-up): when the session's project syncs across devices, an
 * in-place row edit would not propagate, so the host passes
 * `editLastUserMessageDisabledReason` and the pencil renders disabled with that
 * tooltip instead of opening the inline editor.
 */

import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as rtl from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { RichTranscriptView } from '../RichTranscriptView';
import type { TranscriptViewMessage } from '../../../../ai/server/transcript/TranscriptProjector';

const { render, screen } = rtl;

// jsdom does not implement the CSS Custom Highlight API that
// TranscriptSearchBar wires up on mount. Stub just enough for the mount
// effect to run without throwing.
beforeAll(() => {
  const cssGlobal = (globalThis as unknown as { CSS?: Record<string, unknown> }).CSS ?? {};
  if (!cssGlobal.highlights) cssGlobal.highlights = new Map();
  (globalThis as unknown as { CSS?: Record<string, unknown> }).CSS = cssGlobal;
  if (!(globalThis as unknown as { Highlight?: unknown }).Highlight) {
    (globalThis as unknown as { Highlight: unknown }).Highlight = class {};
  }
});

// Child widgets may reach for posthog; stub it so the render stays headless.
vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

// virtua's VList virtualizes by measured viewport height, which is 0 under
// jsdom -- so it materializes no rows and the pencil never mounts. Replace it
// with a pass-through that renders every child and exposes no-op handle
// methods the component calls in its scroll effects.
vi.mock('virtua', () => ({
  VList: React.forwardRef(function MockVList(
    props: { children?: React.ReactNode; className?: string },
    ref: React.Ref<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: () => {},
      scrollToOffset: () => {},
      findItemIndex: () => 0,
      cache: undefined,
      scrollOffset: 0,
      viewportSize: 0,
      scrollSize: 0,
    }));
    return <div className={props.className}>{props.children}</div>;
  }),
}));

vi.mock('../../../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <JotaiProvider store={createStore()}>{children}</JotaiProvider>;
}

function tailUserMessage(): TranscriptViewMessage {
  return {
    id: 1,
    sequence: 1,
    createdAt: new Date(),
    type: 'user_message',
    subagentId: null,
    text: 'original prompt',
  };
}

function renderTranscript(extraProps: Record<string, unknown>) {
  return render(
    <Wrapper>
      <RichTranscriptView
        sessionId="session-1"
        messages={[tailUserMessage()]}
        isProcessing={false}
        {...extraProps}
      />
    </Wrapper>,
  );
}

describe('RichTranscriptView edit affordance', () => {
  it('renders an enabled pencil for the idle tail user message', () => {
    renderTranscript({ onEditLastUserMessage: vi.fn() });

    const pencil = screen.getByTitle('Edit and re-send this message') as HTMLButtonElement;
    expect(pencil.disabled).toBe(false);
  });

  it('renders the pencil disabled with the host-provided reason when the project syncs', () => {
    const reason = 'Editing is unavailable while this project syncs across devices';
    renderTranscript({
      onEditLastUserMessage: vi.fn(),
      editLastUserMessageDisabledReason: reason,
    });

    // The active tooltip is gone; the disabled pencil carries the reason.
    expect(screen.queryByTitle('Edit and re-send this message')).toBeNull();
    const disabledPencil = screen.getByTitle(reason) as HTMLButtonElement;
    expect(disabledPencil.disabled).toBe(true);
  });

  it('omits the pencil entirely when no edit handler is provided', () => {
    renderTranscript({});

    expect(screen.queryByTitle('Edit and re-send this message')).toBeNull();
  });
});
