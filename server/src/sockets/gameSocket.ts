import { Server, Socket } from 'socket.io';

interface PlayerState {
  id: string;
  username: string;
  carId: string;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion [x, y, z, w]
  speed: number;
  steeringAngle: number;
  nitroActive: boolean;
  isDrifting: boolean;
  ping: number;
}

interface Room {
  id: string;
  name: string;
  trackId: string;
  players: { [socketId: string]: PlayerState };
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  maxPlayers: number;
  countdownTime: number;
}

const rooms: { [roomId: string]: Room } = {};

export function initGameSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;
    let username = socket.handshake.query.username as string || 'Racer_' + socket.id.substring(0, 4);
    let carId = socket.handshake.query.carId as string || 'starter_car';

    console.log(`🔌 Client connected: ${socket.id} (${username})`);

    // Matchmaking / Join room
    socket.on('join_room', ({ trackId, requestedRoomId }: { trackId: string; requestedRoomId?: string }) => {
      let room: Room | undefined;

      if (requestedRoomId) {
        room = rooms[requestedRoomId];
      } else {
        // Find existing waiting room for this track
        room = Object.values(rooms).find(r => r.trackId === trackId && r.status === 'waiting' && Object.keys(r.players).length < r.maxPlayers);
      }

      // If no room found, create one
      if (!room) {
        const roomId = requestedRoomId || 'room_' + Math.floor(100000 + Math.random() * 900000);
        room = {
          id: roomId,
          name: `Cyber Race ${roomId.substring(5)}`,
          trackId,
          players: {},
          status: 'waiting',
          maxPlayers: 4,
          countdownTime: 5
        };
        rooms[roomId] = room;
      }

      currentRoomId = room.id;
      socket.join(room.id);

      // Add player to room
      room.players[socket.id] = {
        id: socket.id,
        username,
        carId,
        position: [0, 0.5, 0],
        rotation: [0, 0, 0, 1],
        speed: 0,
        steeringAngle: 0,
        nitroActive: false,
        isDrifting: false,
        ping: 0
      };

      console.log(`🚗 Player ${username} joined Room ${room.id} (${Object.keys(room.players).length}/${room.maxPlayers})`);

      // Notify everyone in the room
      io.to(room.id).emit('room_update', room);

      // Start race countdown if room is full
      if (Object.keys(room.players).length >= 2 && room.status === 'waiting') {
        startRoomCountdown(io, room.id);
      }
    });

    // Telemetry Sync (very high frequency)
    socket.on('update_state', (state: Partial<PlayerState>) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      const player = room.players[socket.id];
      if (player) {
        // Update values
        if (state.position) player.position = state.position;
        if (state.rotation) player.rotation = state.rotation;
        if (state.speed !== undefined) player.speed = state.speed;
        if (state.steeringAngle !== undefined) player.steeringAngle = state.steeringAngle;
        if (state.nitroActive !== undefined) player.nitroActive = state.nitroActive;
        if (state.isDrifting !== undefined) player.isDrifting = state.isDrifting;
        player.ping = state.ping || 0;

        // Broadcast to other players in the room
        socket.to(currentRoomId).emit('player_moved', {
          id: socket.id,
          ...state
        });
      }
    });

    // Leave room
    socket.on('leave_room', () => {
      handleDisconnect(io, socket, currentRoomId);
      currentRoomId = null;
    });

    // Trigger Nitro visual effect across clients
    socket.on('nitro_trigger', (active: boolean) => {
      if (currentRoomId) {
        socket.to(currentRoomId).emit('player_nitro', { id: socket.id, active });
      }
    });

    // Collision event (sparks, sound trigger)
    socket.on('collision_event', (data: { force: number; point: [number, number, number] }) => {
      if (currentRoomId) {
        socket.to(currentRoomId).emit('player_collided', { id: socket.id, ...data });
      }
    });

    // Chat Message
    socket.on('send_chat', (message: string) => {
      if (currentRoomId) {
        io.to(currentRoomId).emit('chat_message', {
          senderId: socket.id,
          senderName: username,
          message,
          timestamp: Date.now()
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      handleDisconnect(io, socket, currentRoomId);
    });
  });
}

function handleDisconnect(io: Server, socket: Socket, roomId: string | null) {
  if (!roomId || !rooms[roomId]) return;
  const room = rooms[roomId];
  delete room.players[socket.id];

  console.log(`🚗 Player left Room ${roomId}. Remaining: ${Object.keys(room.players).length}`);

  if (Object.keys(room.players).length === 0) {
    // Delete empty room
    delete rooms[roomId];
    console.log(`🧹 Room ${roomId} is empty and has been deleted.`);
  } else {
    // Notify remaining players
    io.to(roomId).emit('player_left', socket.id);
    io.to(roomId).emit('room_update', room);

    // Cancel countdown if people left and room is not ready
    if (Object.keys(room.players).length < 2 && room.status === 'countdown') {
      room.status = 'waiting';
      io.to(roomId).emit('room_update', room);
    }
  }
}

function startRoomCountdown(io: Server, roomId: string) {
  const room = rooms[roomId];
  if (!room || room.status !== 'waiting') return;

  room.status = 'countdown';
  room.countdownTime = 5;
  io.to(roomId).emit('room_update', room);

  const interval = setInterval(() => {
    const activeRoom = rooms[roomId];
    if (!activeRoom || activeRoom.status !== 'countdown') {
      clearInterval(interval);
      return;
    }

    activeRoom.countdownTime -= 1;
    io.to(roomId).emit('countdown_tick', activeRoom.countdownTime);

    if (activeRoom.countdownTime <= 0) {
      activeRoom.status = 'racing';
      io.to(roomId).emit('race_start');
      clearInterval(interval);
    }
  }, 1000);
}
