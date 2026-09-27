import { useCallback, useState } from 'react';

type SetBoolean = React.Dispatch<React.SetStateAction<boolean>>;

/**
 * Owns the sticky mini-compass widget state for the map screen, keeping it
 * out of the MaplibreMap component body.
 *
 * Exclusivity rule: only one compass UI is visible at a time — opening the
 * full compass panel hides the mini widget, and floating the mini widget
 * closes the full panel.
 */
export function useMiniCompass(compassOpen: boolean, setCompassOpen: SetBoolean) {
  const [miniCompassOpen, setMiniCompassOpen] = useState(false);

  const handleCompassToolPress = useCallback(() => {
    if (!compassOpen) setMiniCompassOpen(false);
    setCompassOpen((v) => !v);
  }, [compassOpen, setCompassOpen]);

  const openMiniCompass = useCallback(() => {
    setCompassOpen(false);
    setMiniCompassOpen(true);
  }, [setCompassOpen]);

  const closeMiniCompass = useCallback(() => {
    setMiniCompassOpen(false);
  }, []);

  return {
    miniCompassOpen,
    openMiniCompass,
    closeMiniCompass,
    handleCompassToolPress,
    compassToolActive: compassOpen || miniCompassOpen,
  } as const;
}
