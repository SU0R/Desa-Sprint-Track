import { type Room } from '@/types/sprint-tracker';

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createRoomPlaceholderService() {
  return {
    create(name: string): Room {
      return {
        id: `room-${Math.random().toString(36).slice(2, 10)}`,
        name,
        code: createCode(),
        createdAt: new Date().toISOString(),
        status: 'placeholder'
      };
    },
    join(code: string, existingRooms: Room[]) {
      const existing = existingRooms.find((room) => room.code === code);
      if (existing) {
        return existing;
      }

      return {
        id: `room-${Math.random().toString(36).slice(2, 10)}`,
        name: `Joined room ${code}`,
        code,
        createdAt: new Date().toISOString(),
        status: 'placeholder'
      } satisfies Room;
    }
  };
}
