import type { Store } from "./domain";

export const STORAGE_KEY = "personal-learning-os-v01";
export const CURRENT_SCHEMA_VERSION = 2;

const blankStore: Store = {
  goals: [],
  courses: [],
  tasks: [],
  sessions: [],
  reviews: [],
  schedule: [],
  availability: {}
};

type PersistedStore = Store & { schemaVersion?: number };

function migrate(raw: unknown): Store {
  if (!raw || typeof raw !== "object") return blankStore;
  const source = raw as PersistedStore;
  const migrated: PersistedStore = {
    ...blankStore,
    ...source,
    schemaVersion: CURRENT_SCHEMA_VERSION
  };
  return {
    goals: Array.isArray(migrated.goals) ? migrated.goals : [],
    courses: Array.isArray(migrated.courses) ? migrated.courses : [],
    tasks: Array.isArray(migrated.tasks) ? migrated.tasks : [],
    sessions: Array.isArray(migrated.sessions) ? migrated.sessions : [],
    reviews: Array.isArray(migrated.reviews) ? migrated.reviews : [],
    schedule: Array.isArray(migrated.schedule) ? migrated.schedule : [],
    availability: migrated.availability && typeof migrated.availability === "object" ? migrated.availability : {}
  };
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return migrate(raw ? JSON.parse(raw) : null);
  } catch {
    return blankStore;
  }
}

export function saveStore(store: Store): void {
  const persisted: PersistedStore = { ...store, schemaVersion: CURRENT_SCHEMA_VERSION };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}
