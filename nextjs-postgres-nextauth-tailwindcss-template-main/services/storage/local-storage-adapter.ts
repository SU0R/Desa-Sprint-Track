import { demoSprintTrackerData } from '@/services/storage/demo-data';
import { type SprintTrackerData } from '@/types/sprint-tracker';

const STORAGE_KEY = 'sprint-tracker.v1';

export interface SprintTrackerStorageAdapter {
  load: () => SprintTrackerData;
  save: (data: SprintTrackerData) => void;
}

export function createLocalStorageAdapter(): SprintTrackerStorageAdapter {
  return {
    load() {
      if (typeof window === 'undefined') {
        return demoSprintTrackerData;
      }

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSprintTrackerData));
        return demoSprintTrackerData;
      }

      try {
        return JSON.parse(raw) as SprintTrackerData;
      } catch {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSprintTrackerData));
        return demoSprintTrackerData;
      }
    },
    save(data) {
      if (typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  };
}
