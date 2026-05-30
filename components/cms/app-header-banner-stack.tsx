import { AppErrorBannerStrip } from '@/components/cms/app-error-banner';
import { AppPromotionBannerStrip } from '@/components/cms/app-promotion-banner';

/** Global strips below navigation headers — promotion above incident error. */
export function AppHeaderBannerStack() {
  return (
    <>
      <AppPromotionBannerStrip />
      <AppErrorBannerStrip />
    </>
  );
}
