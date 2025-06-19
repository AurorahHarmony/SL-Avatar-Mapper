import axios from "axios";
import { peers } from "../routes/map/avatar-positions";
import { load } from "cheerio";
import prisma from "~/lib/prisma";
interface AvatarInfo {
  id: string;
  name: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
}

const DAY_MS = 1000 * 60 * 60 * 24; // One day in ms

const avatarImageCache = new Map<
  string,
  { imageUrl: string; updatedAt: number }
>();

let avatarList: (AvatarInfo & { image: string | null })[] = [];

export function getAvatarList() {
  return avatarList;
}

async function fetchProfileImage(avatarId: string): Promise<string> {
  const now = Date.now();
  // Check in memory cache
  if (avatarImageCache.has(avatarId)) {
    const cacheAvatar = avatarImageCache.get(avatarId)!;
    if (now - cacheAvatar.updatedAt < DAY_MS) {
      return cacheAvatar.imageUrl;
    }
  } else {
    // Check DB cache if no memcache
    const dbAvatar = await prisma.avatarProfileImage.findUnique({
      where: { id: avatarId },
    });
    if (dbAvatar) {
      const updatedAt = new Date(dbAvatar.updatedAt).getTime();
      if (now - updatedAt < DAY_MS) {
        avatarImageCache.set(avatarId, {
          imageUrl: dbAvatar.imageUrl,
          updatedAt: updatedAt,
        });
        return dbAvatar.imageUrl;
      }
    }
  }

  // No image in memory or database, or it's out of date. Scrape one.
  try {
    const res = await axios.get(
      `https://world.secondlife.com/resident/${avatarId}`
    );
    const $ = load(res.data);
    const imgId = $('meta[name="imageid"]').attr("content");

    console.log(imgId);

    const imageUrl =
      imgId === "00000000-0000-0000-0000-000000000000"
        ? ""
        : `https://picture-service.secondlife.com/${imgId}/256x192.jpg`;

    avatarImageCache.set(avatarId, { imageUrl, updatedAt: now });

    await prisma.avatarProfileImage.upsert({
      where: { id: avatarId },
      update: { imageUrl },
      create: { id: avatarId, imageUrl },
    });

    return imageUrl;
  } catch (err) {
    console.warn(`❌ Failed to fetch profile image for ${avatarId}`, err);
  }

  return "";
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
