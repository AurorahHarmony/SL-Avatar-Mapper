import axios from "axios";
import { peers } from "../routes/map/avatar-positions";
import { load } from "cheerio";
import prisma from "~/lib/prisma";
import { runInBackground } from "~/utils/run-in-background";
import { encode } from "blurhash";
import sharp from "sharp";

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
  { imageUrl: string; blurHash: string | ""; updatedAt: number }
>();

let avatarList: (AvatarInfo & {
  image: string | null;
  blurHash: string | "";
})[] = [];

export function getAvatarList() {
  return avatarList;
}

async function fetchProfileImage(
  avatarId: string
): Promise<{ imageUrl: string; blurHash: string | "" }> {
  const now = Date.now();
  // Check in memory cache
  if (avatarImageCache.has(avatarId)) {
    const cacheAvatar = avatarImageCache.get(avatarId)!;
    if (now - cacheAvatar.updatedAt < DAY_MS) {
      return {
        imageUrl: cacheAvatar.imageUrl,
        blurHash: cacheAvatar.blurHash,
      };
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
          blurHash: dbAvatar.blurHash,
          updatedAt: updatedAt,
        });
        return {
          imageUrl: dbAvatar.imageUrl,
          blurHash: dbAvatar.blurHash,
        };
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

    avatarImageCache.set(avatarId, { imageUrl, blurHash: "", updatedAt: now });

    await prisma.avatarProfileImage.upsert({
      where: { id: avatarId },
      update: { imageUrl },
      create: { id: avatarId, imageUrl },
    });

    runInBackground(() => generateBlurHash(avatarId, imageUrl));

    return { imageUrl, blurHash: "" };
  } catch (err) {
    console.warn(`❌ Failed to fetch profile image for ${avatarId}`, err);
  }

  return { imageUrl: "", blurHash: "" };
}

const generateBlurHash = async (avatarId: string, imageUrl: string) => {
  if (imageUrl) {
    try {
      const response = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: "arraybuffer",
      });
      const imageBuffer = Buffer.from(response.data);

      // Decode image to raw RGBA pixels WITHOUT resizing
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8ClampedArray(data);

      // Encode blurhash with 4x4 components (like official example)
      const blurhash = encode(pixels, info.width, info.height, 4, 3);

      await prisma.avatarProfileImage.update({
        where: { id: avatarId },
        data: { blurHash: blurhash },
      });

      const cached = avatarImageCache.get(avatarId);
      if (cached) {
        avatarImageCache.set(avatarId, {
          ...cached,
          blurHash: blurhash,
        });
      }
      return;
    } catch (err) {
      console.warn("Failed to encode blurhash", err);

      await prisma.avatarProfileImage.update({
        where: { id: avatarId },
        data: { imageUrl: "" },
      });

      const cached = avatarImageCache.get(avatarId);
      if (cached) {
        avatarImageCache.set(avatarId, {
          ...cached,
          imageUrl: "",
        });
      }
    }
  }

  const blurhash = "LHFrY|xc_Nxu-=M{s?R$t7xvM_oM"; // Default / avatar placeholder
  // Instead use the default
  await prisma.avatarProfileImage.update({
    where: { id: avatarId },
    data: { blurHash: blurhash },
  });

  const cached = avatarImageCache.get(avatarId);
  if (cached) {
    avatarImageCache.set(avatarId, {
      ...cached,
      blurHash: blurhash,
    });
  }
};

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as AvatarInfo[];

  // Attach image URLs
  const enriched = await Promise.all(
    body.map(async (avatar) => {
      const { imageUrl, blurHash } = await fetchProfileImage(avatar.id);
      return { ...avatar, image: imageUrl, blurHash };
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
