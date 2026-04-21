'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import {
  createLocalStorageAdapter,
  type SprintTrackerStorageAdapter
} from '@/services/storage/local-storage-adapter';
import { createRoomPlaceholderService } from '@/services/rooms/room-service';
import {
  type Attempt,
  type EventType,
  type Room,
  type Session,
  type SprintTrackerData
} from '@/types/sprint-tracker';

type StoreContextValue = {
  isLoaded: boolean;
  user: SprintTrackerData['user'];
  sessions: Session[];
  attempts: Attempt[];
  rooms: Room[];
  createSession: (input: {
    title: string;
    date: string;
    notes?: string;
  }) => Session;
  addAttempt: (
    sessionId: string,
    input: {
      eventType: EventType;
      time: number;
      notes?: string;
      videoReference?: string;
      captureMode?: Attempt['captureMode'];
      detectionMethod?: Attempt['detectionMethod'];
      detectionMarkerPosition?: Attempt['detectionMarkerPosition'];
      detectionThreshold?: Attempt['detectionThreshold'];
    }
  ) => Attempt;
  createRoom: (name: string) => Room;
  joinRoomPlaceholder: (code: string) => Room | null;
  getSessionById: (id: string) => Session | undefined;
  getAttemptsForSession: (sessionId: string) => Attempt[];
};

const SprintTrackerContext = createContext<StoreContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SprintTrackerProvider({ children }: { children: ReactNode }) {
  const [adapter] = useState<SprintTrackerStorageAdapter>(() =>
    createLocalStorageAdapter()
  );
  const [data, setData] = useState<SprintTrackerData>(() => adapter.load());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setData(adapter.load());
    setIsLoaded(true);
  }, [adapter]);

  const roomService = useMemo(() => createRoomPlaceholderService(), []);

  const updateData = (updater: (current: SprintTrackerData) => SprintTrackerData) => {
    setData((current) => {
      const next = updater(current);
      adapter.save(next);
      return next;
    });
  };

  const value = useMemo<StoreContextValue>(
    () => ({
      isLoaded,
      user: data.user,
      sessions: data.sessions,
      attempts: data.attempts,
      rooms: data.rooms,
      createSession: ({ title, date, notes }) => {
        const session: Session = {
          id: createId('session'),
          userId: data.user.id,
          date: new Date(date).toISOString(),
          title,
          notes: notes?.trim()
        };

        updateData((current) => ({
          ...current,
          sessions: [session, ...current.sessions]
        }));

        return session;
      },
      addAttempt: (sessionId, input) => {
        const attempt: Attempt = {
          id: createId('attempt'),
          sessionId,
          eventType: input.eventType,
          time: input.time,
          createdAt: new Date().toISOString(),
          notes: input.notes?.trim() || undefined,
          videoReference: input.videoReference?.trim() || undefined,
          captureMode: input.captureMode,
          detectionMethod: input.detectionMethod,
          detectionMarkerPosition: input.detectionMarkerPosition,
          detectionThreshold: input.detectionThreshold
        };

        updateData((current) => ({
          ...current,
          attempts: [attempt, ...current.attempts],
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, date: new Date().toISOString() }
              : session
          )
        }));

        return attempt;
      },
      createRoom: (name) => {
        const room = roomService.create(name);
        updateData((current) => ({
          ...current,
          rooms: [room, ...current.rooms]
        }));
        return room;
      },
      joinRoomPlaceholder: (code) => {
        if (!code || code.length !== 6) {
          return null;
        }

        const joined = roomService.join(code, data.rooms);
        if (!joined) {
          return null;
        }

        updateData((current) => ({
          ...current,
          rooms: current.rooms.some((room) => room.id === joined.id)
            ? current.rooms
            : [joined, ...current.rooms]
        }));

        return joined;
      },
      getSessionById: (id) => data.sessions.find((session) => session.id === id),
      getAttemptsForSession: (sessionId) =>
        data.attempts.filter((attempt) => attempt.sessionId === sessionId)
    }),
    [adapter, data, isLoaded, roomService]
  );

  return (
    <SprintTrackerContext.Provider value={value}>
      {children}
    </SprintTrackerContext.Provider>
  );
}

export function useSprintTrackerStore() {
  const context = useContext(SprintTrackerContext);

  if (!context) {
    throw new Error('useSprintTrackerStore must be used inside SprintTrackerProvider.');
  }

  return context;
}
