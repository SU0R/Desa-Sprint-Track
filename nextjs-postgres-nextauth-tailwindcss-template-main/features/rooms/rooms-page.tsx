'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, Copy, Signal } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSprintTrackerStore } from '@/hooks/use-sprint-tracker-store';
import { formatDate } from '@/lib/format';

export function RoomsPage() {
  const { rooms, createRoom, joinRoomPlaceholder } = useSprintTrackerStore();
  const [name, setName] = useState('Track Setup A');
  const [code, setCode] = useState('');
  const [joinedCode, setJoinedCode] = useState<string | null>(null);

  const previewCode = useMemo(
    () => code.replace(/\D/g, '').slice(0, 6),
    [code]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Room scaffold</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This v1 keeps the room feature intentionally light. You can create
              six-digit room codes and visualize how the flow might feel before
              adding real-time device sync later.
            </p>
            <div className="rounded-2xl border border-dashed border-white/10 p-4">
              <p className="font-medium text-white">Future extension seam</p>
              <p className="mt-2">
                Room state is isolated behind a placeholder service so WebSocket,
                Pusher, or Liveblocks-style sync can replace the local mock later
                without rewriting the UI flow.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="text-xl text-white">Create room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Room label"
                className="border-white/10 bg-white/[0.04]"
              />
              <Button
                className="w-full"
                onClick={() => createRoom(name || 'Sprint Setup')}
              >
                Generate room code
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="text-xl text-white">Join room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter six-digit code"
                inputMode="numeric"
                className="border-white/10 bg-white/[0.04] tracking-[0.45em]"
              />
              <Button
                variant="outline"
                className="w-full border-white/10 bg-white/[0.04]"
                onClick={() => {
                  const result = joinRoomPlaceholder(previewCode);
                  setJoinedCode(result?.code ?? null);
                }}
              >
                Join placeholder room
              </Button>
              {joinedCode && (
                <p className="text-sm text-primary">
                  Joined mock room {joinedCode}. Networking is intentionally
                  deferred in v1.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="glass-panel border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-2xl text-white">Available rooms</CardTitle>
          <ArrowRightLeft className="h-5 w-5 text-accent" />
        </CardHeader>
        <CardContent className="space-y-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{room.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Created {formatDate(room.createdAt)}
                  </p>
                </div>
                <Badge className="bg-accent/15 text-accent hover:bg-accent/15">
                  {room.code}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Signal className="h-4 w-4" />
                  Placeholder sync status
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-primary"
                  onClick={() => navigator.clipboard?.writeText(room.code)}
                >
                  <Copy className="h-4 w-4" />
                  Copy code
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
