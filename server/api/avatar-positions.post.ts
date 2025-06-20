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
  isStaff: boolean;
})[] = [];

export function getAvatarList() {
  return avatarList;
}

const STAFF_UUIDS = new Set([
  "54de3375-a7b0-4f76-b47b-5c8ff9a55431", // Vespy
  "22624025-ec67-46d4-b231-f71481df98df", // Breezy
  "15ae1300-9002-4ad5-a835-a1506684122f", // Scankatze
  "09cc3a00-2e2a-4aa9-a3b1-c2c3d82c5886", // Nea
  "63fc826f-5443-4977-897f-1b2faacb8d2f", // Hereafter
  "30a123a0-e854-4fae-81f3-977752ab24b0", // Electric Arc
]);

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
      return {
        ...avatar,
        image: imageUrl,
        blurHash,
        isStaff: STAFF_UUIDS.has(avatar.id),
      };
    })
  );

  avatarList = enriched.sort((a, b) => {
    // Sort staff first
    if (a.isStaff && !b.isStaff) return -1;
    if (!a.isStaff && b.isStaff) return 1;
    return 0; // preserve order otherwise
  });

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
