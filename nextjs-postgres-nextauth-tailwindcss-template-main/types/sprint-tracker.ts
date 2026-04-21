export const EVENT_TYPES = [
  '40-yard dash',
  '100m',
  '200m',
  '400m'
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type User = {
  id: string;
  username: string;
};

export type Session = {
  id: string;
  userId: string;
  date: string;
  title: string;
  notes?: string;
};

export type Attempt = {
  id: string;
  sessionId: string;
  eventType: EventType;
  time: number;
  createdAt: string;
  notes?: string;
  videoReference?: string;
  captureMode?: 'manual' | 'camera';
  detectionMethod?: 'motion-band' | 'pose-landmarker' | 'motion-fallback';
  detectionMarkerPosition?: number;
  detectionThreshold?: number;
  detectionConfidence?: number;
  detectionLandmark?: string;
  detectionTimestampMs?: number;
};

export type Room = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  status: 'placeholder';
};

export type SprintTrackerData = {
  user: User;
  sessions: Session[];
  attempts: Attempt[];
  rooms: Room[];
};
