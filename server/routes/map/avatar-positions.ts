import type { Peer } from "crossws";

export const peers = new Set<Peer>();

export default defineWebSocketHandler({
  open(peer) {
    peers.add(peer);
  },
  close(peer) {
    peers.delete(peer);
  },
});
