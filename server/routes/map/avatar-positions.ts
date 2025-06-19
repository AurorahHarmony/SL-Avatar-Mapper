import type { Peer } from "crossws";
import { getAvatarList } from "~/server/api/avatar-positions.post";

export const peers = new Set<Peer>();

export default defineWebSocketHandler({
  open(peer) {
    peers.add(peer);
    try {
      if (peer.websocket && typeof peer.websocket.send === "function") {
        const message = JSON.stringify({ data: getAvatarList() });
        peer.websocket.send(message);
      }
    } catch (err) {
      console.warn("Failed to send to peer:", err);
    }
  },
  close(peer) {
    peers.delete(peer);
  },
});
