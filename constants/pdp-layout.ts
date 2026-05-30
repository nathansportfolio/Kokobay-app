/** PDP hero gallery — tall, editorial, capped so short phones still scroll to content */
export function pdpGalleryHeight(width: number, windowHeight: number): number {
  return Math.min(Math.round(width * 1.36), Math.round(windowHeight * 0.56));
}
