import { UpdateAvailableDrawer } from '@/components/update/update-available-drawer';
import { UpdateRequiredDrawer } from '@/components/update/update-required-drawer';
import { useAppVersionCheck } from '@/src/core/app-version/use-app-version-check';

/** Full-screen update overlays — rendered above all navigators. */
export function AppUpdateGate() {
  const { prompt, title, message, currentVersion, config, dismissOptional } =
    useAppVersionCheck();

  const latestVersion = config?.latestVersion;

  return (
    <>
      <UpdateRequiredDrawer
        visible={prompt === 'required'}
        title={title}
        message={message}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
      />
      <UpdateAvailableDrawer
        visible={prompt === 'optional'}
        title={title}
        message={message}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        onDismiss={dismissOptional}
      />
    </>
  );
}
