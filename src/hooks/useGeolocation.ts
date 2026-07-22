import { useState } from 'react';

interface GeoLocation {
  lat?: number;
  lng?: number;
  error?: string;
}

export default function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation>({});

  function getLocation(): Promise<GeoLocation> {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        const error = { error: 'Geolocation not supported' };
        setLocation(error);
        resolve(error);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          const data = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };

          setLocation(data);
          resolve(data);
        },

        () => {
          const error = { error: 'Location permission denied' };
          setLocation(error);
          resolve(error);
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  }

  return { location, getLocation };
}
