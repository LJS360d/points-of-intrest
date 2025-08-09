import Peer, { type DataConnection } from "peerjs";
import { createStore } from "solid-js/store";

export interface GameInvitation {
  from: string;
  to: string;
  connectionId: string;
}

export interface PeerStore {
  peer: Peer;
  invites: Set<GameInvitation>;
  connection: DataConnection | null;
  isHost: boolean | null;
}

function generatePeerIdNumber() {
  const randomNumber = Math.random(); // Generates a float between 0 (inclusive) and 1 (exclusive)
  const scaledNumber = Math.floor(randomNumber * 1000000000); // Scale to a 9-digit number
  const paddedNumber = String(scaledNumber).padStart(9, "0"); // Ensure it's always 9 digits with leading zeros
  return paddedNumber;
}

export const usePeerStore = createStore<PeerStore>({
  peer: new Peer(generatePeerIdNumber()),
  connection: null,
  invites: new Set(),
  isHost: null,
});

export const [peerStore, setPeerStore] = usePeerStore;

peerStore.peer.on("connection", managePeerDataConnection);

export function managePeerDataConnection(connection: DataConnection) {
  connection.on("data", (data) => {
    if (Number(import.meta.env.VITE_EXCALIBUR_DEBUG)) {
      console.log("data:", data);
    }
    peerDataHandler(data as any);
  });

  connection.on("open", () => {
    console.log("connection opened");
    setPeerStore("connection", connection);
  });
  connection.on("close", () => {
    console.log("Connection closed:", connection.connectionId);
  });
  connection.on("error", (err) => {
    console.error("Connection error:", err);
  });
  connection.on("iceStateChanged", (state) => {
    console.log("ICE state changed:", state);
  });

  setTimeout(() => {
    if (connection && !connection.open) {
      window.alert(
        "Seems like your browser is not supporting peer-to-peer connections, check your WebRTC settings or try with another browser.",
      );
    }
  }, 5000);
}

function peerDataHandler({ msg, ...data }: { msg: string;[x: string]: any }) {
  switch (msg) {
    case "invitation": {
      const newSet = new Set(peerStore.invites);
      newSet.add({
        from: data.from,
        to: data.to,
        connectionId: data.connectionId,
      });
      setPeerStore("invites", newSet);
      break;
    }
    case "accept": {
      for (const invite of peerStore.invites) {
        if (invite.connectionId === data.connectionId) {
          const newSet = new Set(peerStore.invites);
          newSet.delete(invite);
          setPeerStore("invites", newSet);
          break;
        }
      }
      break;
    }
    case "decline": {
      break;
    }

    default: {
      break;
    }
  }
}
