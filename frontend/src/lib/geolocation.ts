export type GeolocationErrorCode =
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export class GeolocationError extends Error {
  code: GeolocationErrorCode;

  constructor(code: GeolocationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_AGE_MS = 0;

function mapGeolocationError(error: GeolocationPositionError): GeolocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new GeolocationError(
        'denied',
        'Location access is required to mark WFO attendance.',
      );
    case error.POSITION_UNAVAILABLE:
      return new GeolocationError(
        'unavailable',
        'Your location is unavailable. Please try again.',
      );
    case error.TIMEOUT:
      return new GeolocationError(
        'timeout',
        'Location request timed out. Please try again.',
      );
    default:
      return new GeolocationError('unknown', 'Could not get your location.');
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function getCurrentPosition(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GeolocationResult> {
  if (!isGeolocationSupported()) {
    return Promise.reject(
      new GeolocationError(
        'unsupported',
        'Your browser does not support location services.',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => reject(mapGeolocationError(error)),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: DEFAULT_MAX_AGE_MS,
      },
    );
  });
}
