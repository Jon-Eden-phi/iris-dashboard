import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Safety hatch: visiting any URL with ?resetDataRoom=1 wipes the Data Room
 * store (IndexedDB + legacy localStorage) BEFORE the app boots. This runs
 * before routing/auth, so it works even from the login page — letting a user
 * escape a corrupted or oversized store that would otherwise crash the tab.
 */
async function maybeResetDataRoom(): Promise<void> {
  if (!/[?&]resetDataRoom=1/.test(location.search)) return;
  try { localStorage.removeItem('iris_data_room'); } catch { /* ignore */ }
  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('iris_dataroom');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  } catch { /* ignore */ }
}

maybeResetDataRoom().finally(() => {
  bootstrapApplication(App, appConfig)
    .catch((err) => console.error(err));
});
