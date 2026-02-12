export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // WebSocket endpoint: /ws?room=XXXX
    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("room");
      if (!roomId) return new Response("Missing room", { status: 400 });

      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response("OK", { status: 200 });
  },
};

export class RoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map();
    this.nextId = 1;
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const myId = this.nextId++;
    this.sockets.set(myId, server);

    server.addEventListener("message", (evt) => {
      // broadcast to everyone else
      for (const [id, ws] of this.sockets) {
        if (id === myId) continue;
        try { ws.send(evt.data); } catch (e) {}
      }
    });

    const cleanup = () => {
      this.sockets.delete(myId);
      try { server.close(); } catch (e) {}
    };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }
}
