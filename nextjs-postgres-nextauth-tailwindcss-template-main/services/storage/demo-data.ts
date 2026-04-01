import { type SprintTrackerData } from '@/types/sprint-tracker';

export const demoSprintTrackerData: SprintTrackerData = {
  user: {
    id: 'user-athlete',
    username: 'Solo Athlete'
  },
  sessions: [
    {
      id: 'session-evening-speed',
      userId: 'user-athlete',
      date: new Date('2026-03-28T18:30:00.000Z').toISOString(),
      title: 'Evening speed block',
      notes: 'Focus on sharp starts and relaxed turnover.'
    },
    {
      id: 'session-track-rhythm',
      userId: 'user-athlete',
      date: new Date('2026-03-24T16:00:00.000Z').toISOString(),
      title: 'Track rhythm session',
      notes: 'Progressive 100m and 200m work with full recovery.'
    }
  ],
  attempts: [
    {
      id: 'attempt-a',
      sessionId: 'session-evening-speed',
      eventType: '40-yard dash',
      time: 4.98,
      createdAt: new Date('2026-03-28T18:45:00.000Z').toISOString(),
      notes: 'First rep with steady acceleration.',
      videoReference: 'clip-001.mp4'
    },
    {
      id: 'attempt-b',
      sessionId: 'session-evening-speed',
      eventType: '40-yard dash',
      time: 4.9,
      createdAt: new Date('2026-03-28T18:52:00.000Z').toISOString(),
      notes: 'Faster second half.',
      videoReference: 'clip-002.mp4'
    },
    {
      id: 'attempt-c',
      sessionId: 'session-track-rhythm',
      eventType: '100m',
      time: 12.41,
      createdAt: new Date('2026-03-24T16:25:00.000Z').toISOString(),
      notes: 'Relaxed upright sprint.',
      videoReference: 'clip-003.mp4'
    },
    {
      id: 'attempt-d',
      sessionId: 'session-track-rhythm',
      eventType: '200m',
      time: 25.62,
      createdAt: new Date('2026-03-24T16:45:00.000Z').toISOString(),
      notes: 'Smooth backstretch rhythm.',
      videoReference: 'clip-004.mp4'
    }
  ],
  rooms: [
    {
      id: 'room-demo',
      name: 'Demo camera setup',
      code: '402118',
      createdAt: new Date('2026-03-28T18:20:00.000Z').toISOString(),
      status: 'placeholder'
    }
  ]
};
