export type ProductFitData = {
  totalResponses: number;
  fitBreakdown: {
    small: number;
    true: number;
    large: number;
  };
};

/** Indicator position on the fit scale — 0 runs small, 50 true to size, 100 runs large. */
export function computeProductFitIndicatorPosition(fitData: ProductFitData): number {
  const small = fitData.fitBreakdown.small ?? 0;
  const large = fitData.fitBreakdown.large ?? 0;
  const trueFit = fitData.fitBreakdown.true ?? 0;

  const total = small + large + trueFit;
  const smallPct = total ? (small / total) * 100 : 0;
  const largePct = total ? (large / total) * 100 : 0;

  if (smallPct >= 75) return 0;
  if (largePct >= 75) return 100;
  return 50;
}

export function shouldShowProductFitWidget(fitData?: ProductFitData | null): fitData is ProductFitData {
  return Boolean(fitData && fitData.totalResponses >= 3);
}
