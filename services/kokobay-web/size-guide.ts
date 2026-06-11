import { legacyApiGetOptional } from '@/src/core/api';

import type { SizeGuideLetterSize, SizeGuideMeasurement, SizeGuideResponse } from '@/types/size-guide';

import { isKokobayApiConfigured } from './api-config';

function parseMeasurementValue(value: unknown): { inches: number; cm: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const inches = typeof record.inches === 'number' ? record.inches : Number(record.inches);
  const cm = typeof record.cm === 'number' ? record.cm : Number(record.cm);
  if (!Number.isFinite(inches) || !Number.isFinite(cm)) return null;
  return { inches, cm };
}

function parseMeasurement(value: unknown): SizeGuideMeasurement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const ukSize = typeof record.ukSize === 'number' ? record.ukSize : Number(record.ukSize);
  const bust = parseMeasurementValue(record.bust);
  const waist = parseMeasurementValue(record.waist);
  const hips = parseMeasurementValue(record.hips);
  if (!Number.isFinite(ukSize) || !bust || !waist || !hips) return null;
  return { ukSize, bust, waist, hips };
}

function parseLetterSize(value: unknown): SizeGuideLetterSize | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const size = typeof record.size === 'string' ? record.size.trim() : '';
  const ukSizeRange = typeof record.ukSizeRange === 'string' ? record.ukSizeRange.trim() : '';
  if (!size || !ukSizeRange) return null;
  return { size, ukSizeRange };
}

export function parseSizeGuideResponse(json: Record<string, unknown>): SizeGuideResponse | null {
  const title = typeof json.title === 'string' ? json.title.trim() : '';
  if (!title) return null;

  const measurements = Array.isArray(json.measurements)
    ? json.measurements.map(parseMeasurement).filter((row): row is SizeGuideMeasurement => row != null)
    : [];
  if (!measurements.length) return null;

  const letterSizes = Array.isArray(json.letterSizes)
    ? json.letterSizes.map(parseLetterSize).filter((row): row is SizeGuideLetterSize => row != null)
    : [];

  return { title, measurements, letterSizes };
}

/** `GET /api/size-guide` — static UK size chart for the PDP modal. */
export async function fetchSizeGuideFromApi(
  init?: { signal?: AbortSignal },
): Promise<SizeGuideResponse | null> {
  if (!isKokobayApiConfigured()) return null;

  const json = await legacyApiGetOptional('/api/size-guide', {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 1,
    coalesce: false,
  });

  if (init?.signal?.aborted || !json) return null;
  return parseSizeGuideResponse(json);
}
