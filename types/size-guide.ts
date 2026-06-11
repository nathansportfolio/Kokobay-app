export type SizeGuideMeasurement = {
  ukSize: number;
  bust: { inches: number; cm: number };
  waist: { inches: number; cm: number };
  hips: { inches: number; cm: number };
};

export type SizeGuideLetterSize = {
  size: string;
  ukSizeRange: string;
};

/** JSON body for `GET /api/size-guide`. */
export type SizeGuideResponse = {
  title: string;
  measurements: SizeGuideMeasurement[];
  letterSizes: SizeGuideLetterSize[];
};
