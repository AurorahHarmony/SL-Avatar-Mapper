import axios from "axios";
import { peers } from "../routes/map/avatar-positions";
import { load } from "cheerio";

interface AvatarInfo {
  id: string;
  name: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
}

const avatarImageCache = new Map<string, string>();

let avatarList: (AvatarInfo & { image: string | null })[] = [];

export function getAvatarList() {
  return avatarList;
}

async function fetchProfileImage(id: string): Promise<string | null> {
  if (avatarImageCache.has(id)) {
    return avatarImageCache.get(id)!;
  }

  try {
    const res = await axios.get(`https://world.secondlife.com/resident/${id}`);
    const $ = load(res.data);
    const imgId = $('meta[name="imageid"]').attr("content");

    console.log(imgId);

    const imgUrl = `https://picture-service.secondlife.com/${imgId}/256x192.jpg`;

    if (imgUrl) {
      avatarImageCache.set(id, imgUrl);
      return imgUrl;
    }
  } catch (err) {
    console.warn(`❌ Failed to fetch profile image for ${id}`, err);
  }

  return null;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as AvatarInfo[];

  // Attach image URLs
  const enriched = await Promise.all(
    body.map(async (avatar) => {
      const image = await fetchProfileImage(avatar.id);
      return { ...avatar, image };
    })
  );

  avatarList = enriched;

  const message = JSON.stringify({ data: avatarList });
  for (const peer of peers) {
    try {
      if (peer.websocket && typeof peer.websocket.send === "function") {
        peer.websocket.send(message);
      }
    } catch (err) {
      console.warn("Failed to send to peer:", err);
    }
  }

  event.node.res.end();
});
