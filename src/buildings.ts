/** Metadata shared by a building's scene presentation and postcard. */
export interface Building {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly location: string;
}

export const shoreTemple: Building = Object.freeze({
  name: 'Shore Temple',
  latitude: 12.6170,
  longitude: 80.1998,
  location: 'Mahabalipuram',
});

/** Whole-second DMS, with carries handled before splitting degrees/minutes. */
export function formatCoordinates({ latitude, longitude }: Pick<Building, 'latitude' | 'longitude'>): string {
  const format = (value: number, limit: number, positive: string, negative: string) => {
    if (!Number.isFinite(value) || Math.abs(value) > limit) throw new RangeError('Invalid geographic coordinate.');
    const total = Math.round(Math.abs(value) * 3600);
    const degrees = Math.floor(total / 3600);
    const minutes = String(Math.floor(total % 3600 / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${degrees}°${minutes}′${seconds}″${value < 0 ? negative : positive}`;
  };
  return `${format(latitude, 90, 'N', 'S')} ${format(longitude, 180, 'E', 'W')}`;
}
