/**
 * Test du hook useCountdown (rendu via renderHook de @testing-library/react-native,
 * timers simulés) : décompte, pause, appel unique de onFinish.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import { useCountdown } from '../src/hooks/useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('décompte seconde par seconde et finit à 0', () => {
    const onFinish = jest.fn();
    const { result } = renderHook(() => useCountdown(3, { paused: false, onFinish }));
    expect(result.current.remainingSeconds).toBe(3);
    expect(result.current.finished).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(2);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.finished).toBe(true);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('ne redémarre jamais sous zéro et n’appelle onFinish qu’une fois', () => {
    const onFinish = jest.fn();
    const { result } = renderHook(() => useCountdown(1, { paused: false, onFinish }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('est entièrement suspendu quand paused = true', () => {
    const onFinish = jest.fn();
    const { result, rerender } = renderHook(({ paused }: { paused: boolean }) => {
      const [total] = useState(3);
      return useCountdown(total, { paused, onFinish });
    }, { initialProps: { paused: true } });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.remainingSeconds).toBe(3);
    expect(onFinish).not.toHaveBeenCalled();

    rerender({ paused: false });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(2);
  });

  it('applique un repli sûr pour une durée invalide (0 → 10 s)', () => {
    const onFinish = jest.fn();
    const { result } = renderHook(() => useCountdown(0, { paused: false, onFinish }));
    expect(result.current.totalSeconds).toBe(10);
    expect(result.current.remainingSeconds).toBe(10);
  });

  it('notifie onTick à chaque avancement (agrégat de l’appelant)', () => {
    const onTick = jest.fn();
    renderHook(() => useCountdown(2, { paused: false, onFinish: jest.fn(), onTick }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(1, 1);
  });
});
