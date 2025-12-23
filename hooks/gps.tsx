import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type GPSLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  timestamp: number;
};

export function useGPS() {
  const [lastLocation, setLastLocation] = useState<GPSLocation | null>(null);
  const watcherRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (!('geolocation' in navigator)) return undefined;
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setLastLocation({
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
            timestamp: pos.timestamp,
          });
        },
        () => {},
        { enableHighAccuracy: true }
      );
      watcherRef.current = id as unknown as number;
      return () => {
        if (watcherRef.current != null) navigator.geolocation.clearWatch(watcherRef.current);
      };
    }
    return undefined;
  }, []);

  return { lastLocation, setLastLocation } as const;
}

// Component that hooks into maplibre-react-native's UserLocation on native.
// On web the hook above will poll navigator.geolocation, so this renders null.
type UserLocationMarkerProps = {
  onLocation?: (loc: GPSLocation) => void;
};

// Native map view registration can conflict if the native maplibre module
// is required multiple times. Render `UserLocation` from the native map
// component inside the native Map component instead of requiring it here.

// We intentionally do not export a native UserLocation component from
// this file to avoid duplicate native view registration.
