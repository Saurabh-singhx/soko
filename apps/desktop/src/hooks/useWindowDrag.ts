import { useRef, useCallback } from 'react';

export interface UseWindowDragOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * High-performance window dragging hook with requestAnimationFrame delta throttling.
 * Prevents IPC flooding on Windows 11 and coordinate jitter on Linux X11/Wayland.
 */
export function useWindowDrag(options?: UseWindowDragOptions) {
  const isDraggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const pendingDeltaX = useRef(0);
  const pendingDeltaY = useRef(0);

  const flushDragDeltas = useCallback(() => {
    if (pendingDeltaX.current !== 0 || pendingDeltaY.current !== 0) {
      const dx = pendingDeltaX.current;
      const dy = pendingDeltaY.current;
      pendingDeltaX.current = 0;
      pendingDeltaY.current = 0;
      (window as any).electronAPI?.moveWindow?.(dx, dy);
    }
    rafIdRef.current = null;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Primary mouse button only
      if (e.button !== 0) return;
      // Do not initiate window drag on interactive elements
      if ((e.target as HTMLElement).closest('button, input, a, [data-no-drag]')) return;

      e.preventDefault();
      let lastX = e.screenX;
      let lastY = e.screenY;
      isDraggingRef.current = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (moveEvent.buttons !== 1) {
          handleMouseUp();
          return;
        }

        const deltaX = moveEvent.screenX - lastX;
        const deltaY = moveEvent.screenY - lastY;
        lastX = moveEvent.screenX;
        lastY = moveEvent.screenY;

        if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
          if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            options?.onDragStart?.();
          }

          pendingDeltaX.current += deltaX;
          pendingDeltaY.current += deltaY;

          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(flushDragDeltas);
          }
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          flushDragDeltas();
        }

        if (isDraggingRef.current) {
          setTimeout(() => {
            isDraggingRef.current = false;
            options?.onDragEnd?.();
          }, 120);
        } else {
          options?.onDragEnd?.();
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [flushDragDeltas, options]
  );

  return {
    handleMouseDown,
    isDraggingRef,
  };
}
