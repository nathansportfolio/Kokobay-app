import { ZoomableImage } from '@/components/ui/zoomable-image';

export type PdpLightboxZoomSlideProps = {
  uri: string;
  width: number;
  height: number;
  /** When false, zoom resets (user paged to another image). */
  isActive: boolean;
  /** Disable horizontal pager while zoomed so pinch wins over native scroll. */
  onZoomLockChange: (locked: boolean) => void;
};

export function PdpLightboxZoomSlide({
  uri,
  width,
  height,
  isActive,
  onZoomLockChange,
}: PdpLightboxZoomSlideProps) {
  return (
    <ZoomableImage
      uri={uri}
      width={width}
      height={height}
      contentFit="contain"
      backgroundColor="#000"
      isActive={isActive}
      enableDoubleTap
      onZoomLockChange={onZoomLockChange}
    />
  );
}
