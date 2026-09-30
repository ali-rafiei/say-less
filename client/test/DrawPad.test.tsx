import type { Drawing } from '@say-less/shared';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The client tests run in plain Node with no DOM. Hooks are replaced by a tiny slot-based runtime
// so DrawPad can be rendered to an element tree and its pointer handlers driven directly.
const runtime = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: <T,>(initial: T) => {
    const index = runtime.cursor++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    const set = (next: T) => void (runtime.slots[index] = next);
    return [runtime.slots[index] as T, set];
  },
  useRef: <T,>(initial: T) => {
    const index = runtime.cursor++;
    if (!(index in runtime.slots)) runtime.slots[index] = { current: initial };
    return runtime.slots[index] as { current: T };
  },
  useMemo: <T,>(factory: () => T) => factory(),
  useEffect: () => undefined,
}));

// The vitest config has no alias for the workspace package, so point it at the source.
vi.mock('@say-less/shared', () => import('../../shared/src/index.ts'));

interface Handlers {
  onPointerDown: (event: unknown) => void;
  onPointerMove: (event: unknown) => void;
  onPointerUp: (event: unknown) => void;
  onClick: () => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

const EMPTY: Drawing = { strokes: [] };

function findAll(node: ReactNode, matches: (props: Handlers) => boolean): Handlers[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, matches));
  if (typeof node !== 'object' || node === null || !('props' in node)) return [];
  const props = (node as ReactElement<Handlers & { children?: ReactNode }>).props;
  const own = matches(props) ? [props] : [];
  return [...own, ...findAll(props.children as ReactNode, matches)];
}

async function renderPad(value: Drawing, onChange: (next: Drawing) => void, disabled = false) {
  const { DrawPad } = await import('../src/components/DrawPad.tsx');
  runtime.cursor = 0;
  const tree = DrawPad({ value, onChange, disabled });
  return {
    surface: findAll(tree, (p) => typeof p.onPointerDown === 'function')[0]!,
    button: (label: string) => findAll(tree, (p) => p['aria-label'] === label)[0]!,
  };
}

function pointerEvent(pointerId: number, clientX: number, clientY: number) {
  return {
    pointerId,
    clientX,
    clientY,
    preventDefault: vi.fn(),
    currentTarget: {
      // 256 logical units drawn on a 512px square: every client pixel is half a unit
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 512, height: 512 }),
      setPointerCapture: vi.fn(),
    },
  };
}

describe('DrawPad', () => {
  beforeEach(() => {
    runtime.slots = [];
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => (run(), 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports one stroke in logical coordinates after a finger drag', async () => {
    // Arrange
    const onChange = vi.fn();
    const { surface } = await renderPad(EMPTY, onChange);

    // Act
    surface.onPointerDown(pointerEvent(1, 0, 0));
    surface.onPointerMove(pointerEvent(1, 100, 100));
    surface.onPointerMove(pointerEvent(1, 101, 100));
    surface.onPointerUp(pointerEvent(1, 200, 200));

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as Drawing;
    expect(next.strokes).toEqual([{ color: 0, width: 1, points: [0, 0, 50, 50] }]);
  });

  it('removes the last stroke when Undo is pressed', async () => {
    // Arrange
    const onChange = vi.fn();
    const drawn: Drawing = { strokes: [{ color: 0, width: 1, points: [10, 10, 60, 60] }] };
    const { button } = await renderPad(drawn, onChange);

    // Act
    button('Undo last stroke').onClick();

    // Assert
    expect(onChange).toHaveBeenCalledWith({ strokes: [] });
  });

  it('ignores a second finger while the first is drawing', async () => {
    // Arrange
    const onChange = vi.fn();
    const { surface } = await renderPad(EMPTY, onChange);

    // Act
    surface.onPointerDown(pointerEvent(1, 0, 0));
    surface.onPointerDown(pointerEvent(2, 400, 400));
    surface.onPointerMove(pointerEvent(2, 500, 500));
    surface.onPointerUp(pointerEvent(2, 500, 500));
    surface.onPointerUp(pointerEvent(1, 100, 100));

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as Drawing).strokes[0]!.points).toEqual([0, 0]);
  });

  it('never calls onChange while disabled', async () => {
    // Arrange
    const onChange = vi.fn();
    const drawn: Drawing = { strokes: [{ color: 0, width: 1, points: [10, 10] }] };
    const { surface, button } = await renderPad(drawn, onChange, true);

    // Act
    surface.onPointerDown(pointerEvent(1, 0, 0));
    surface.onPointerMove(pointerEvent(1, 100, 100));
    surface.onPointerUp(pointerEvent(1, 100, 100));

    // Assert
    expect(onChange).not.toHaveBeenCalled();
    expect(button('Undo last stroke').disabled).toBe(true);
    expect(button('Clear drawing').disabled).toBe(true);
  });
});
