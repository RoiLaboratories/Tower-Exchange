"use client";

import { useEffect, useMemo, useState } from "react";
import type { AvatarComponent } from "@rainbow-me/rainbowkit";

const colors = [
  "#FC5C54",
  "#FFD95A",
  "#E95D72",
  "#6A87C8",
  "#5FD0F3",
  "#75C06B",
  "#FFDD86",
  "#5FC6D4",
  "#FF949A",
  "#FF8024",
  "#9BA1A4",
  "#EC66FF",
  "#FF8CBC",
  "#FF9A23",
  "#C5DADB",
  "#A8CE63",
  "#71ABFF",
  "#FFE279",
  "#B6B1B6",
  "#FF6780",
  "#A575FF",
  "#4D82FF",
  "#FFB35A",
] as const;

const avatars = [
  { color: colors[0], emoji: "\u{1F336}" },
  { color: colors[1], emoji: "\u{1F911}" },
  { color: colors[2], emoji: "\u{1F419}" },
  { color: colors[3], emoji: "\u{1FAD0}" },
  { color: colors[4], emoji: "\u{1F433}" },
  { color: colors[0], emoji: "\u{1F936}" },
  { color: colors[5], emoji: "\u{1F332}" },
  { color: colors[6], emoji: "\u{1F31E}" },
  { color: colors[7], emoji: "\u{1F412}" },
  { color: colors[8], emoji: "\u{1F435}" },
  { color: colors[9], emoji: "\u{1F98A}" },
  { color: colors[10], emoji: "\u{1F43C}" },
  { color: colors[11], emoji: "\u{1F984}" },
  { color: colors[12], emoji: "\u{1F437}" },
  { color: colors[13], emoji: "\u{1F427}" },
  { color: colors[8], emoji: "\u{1F9A9}" },
  { color: colors[14], emoji: "\u{1F47D}" },
  { color: colors[0], emoji: "\u{1F388}" },
  { color: colors[8], emoji: "\u{1F349}" },
  { color: colors[1], emoji: "\u{1F389}" },
  { color: colors[15], emoji: "\u{1F432}" },
  { color: colors[16], emoji: "\u{1F30E}" },
  { color: colors[17], emoji: "\u{1F34A}" },
  { color: colors[18], emoji: "\u{1F42D}" },
  { color: colors[19], emoji: "\u{1F363}" },
  { color: colors[1], emoji: "\u{1F425}" },
  { color: colors[20], emoji: "\u{1F47E}" },
  { color: colors[15], emoji: "\u{1F966}" },
  { color: colors[0], emoji: "\u{1F479}" },
  { color: colors[17], emoji: "\u{1F640}" },
  { color: colors[4], emoji: "\u26F1" },
  { color: colors[21], emoji: "\u26F5\uFE0F" },
  { color: colors[17], emoji: "\u{1F973}" },
  { color: colors[8], emoji: "\u{1F92F}" },
  { color: colors[22], emoji: "\u{1F920}" },
] as const;

const hashCode = (text: string) => {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash |= 0;
  }

  return hash;
};

const emojiAvatarForAddress = (address: string) => {
  const resolvedAddress = typeof address === "string" ? address : "";
  const avatarIndex = Math.abs(
    hashCode(resolvedAddress.toLowerCase()) % avatars.length,
  );

  return avatars[avatarIndex] ?? avatars[0];
};

interface TowerWalletAvatarProps {
  address: string;
  ensImage?: string | null;
  size?: number;
}

export const TowerWalletAvatar: AvatarComponent = ({
  address,
  ensImage,
  size,
}) => {
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ensImage) return;

    let cancelled = false;
    const image = new window.Image();
    image.src = ensImage;
    image.onload = () => {
      if (!cancelled) {
        setLoadedImageUrl(ensImage);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setLoadedImageUrl(null);
      }
    };

    return () => {
      cancelled = true;
    };
  }, [ensImage]);

  const { color, emoji } = useMemo(
    () => emojiAvatarForAddress(address),
    [address],
  );
  const dimension = size ?? 24;
  const imageLoaded = Boolean(ensImage) && loadedImageUrl === ensImage;
  const avatarStyle = {
    height: dimension,
    width: dimension,
  };

  if (ensImage && imageLoaded) {
    return (
      <span
        aria-hidden="true"
        className="block rounded-full bg-center bg-cover"
        style={{
          ...avatarStyle,
          backgroundImage: `url(${ensImage})`,
        }}
      />
    );
  }

  if (ensImage && !imageLoaded) {
    return (
      <span
        aria-hidden="true"
        className="flex items-center justify-center rounded-full bg-background/10"
        style={avatarStyle}
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/60 border-t-transparent" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center overflow-hidden rounded-full"
      style={{
        ...avatarStyle,
        backgroundColor: color,
        fontSize: `${Math.round(dimension * 0.55)}px`,
        lineHeight: 1,
      }}
    >
      {emoji}
    </span>
  );
};

export const HeaderWalletAvatar = ({
  address,
  ensImage,
  size = 24,
}: TowerWalletAvatarProps) => {
  return <TowerWalletAvatar address={address} ensImage={ensImage} size={size} />;
};
