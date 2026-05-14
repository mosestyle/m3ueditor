import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  Copy as CopyIcon,
  FolderInput,
  Image as ImageIcon,
  ListFilter,
  MoreVertical,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import "./App.css";

type Channel = {
  id: string;
  name: string;
  group: string;
  url: string;
  rawInfo: string;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
};

type EpgChannel = {
  id: string;
  names: string[];
  logo: string;
};

type EpgMatchStatus =
  | "no-epg"
  | "not-target-group"
  | "matched-id"
  | "matched-name"
  | "missing-id"
  | "empty-id";

type EpgMatch = {
  status: EpgMatchStatus;
  epgChannel: EpgChannel | null;
};

type DropTarget = {
  channelId: string;
  position: "above" | "below";
};

type GroupDropTarget = {
  group: string;
  position: "above" | "below";
};

type GroupPickerMode = "copy" | "move";

type ChannelEditForm = {
  id: string;
  name: string;
  url: string;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
};

type DeleteConfirmState = {
  channelIds: string[];
  groupNames: string[];
};

type BulkRenameMode = "contains" | "begins" | "ends";

type BulkRenameForm = {
  prefix: string;
  suffix: string;
  find: string;
  replace: string;
  caseSensitive: boolean;
  mode: BulkRenameMode;
};

type EpgIndexes = {
  byId: Map<string, EpgChannel>;
  byExactName: Map<string, EpgChannel[]>;
  byCleanName: Map<string, EpgChannel[]>;
};

type ContextMenuState = {
  type: "group" | "channel";
  x: number;
  y: number;
} | null;

type LogoStatus = "ok" | "missing" | "broken";

type LogoFilter = "all" | "has-logo" | "missing-logo" | "broken-logo";

type BuiltInEpgCode = {
  name: string;
  code: string;
};

type HistorySnapshot = {
  channels: Channel[];
  groupOrder: string[];
  selectedGroup: string;
  epgTargetGroup: string;
};

const MAX_HISTORY_STEPS = 50;

const SWEDISH_EPG_CODES: BuiltInEpgCode[] = [
  { name: "Animal Planet", code: "AnimalPlanet.se" },
  { name: "ATG Live", code: "ATGLive.se" },
  { name: "Axess TV", code: "AxessTV.se" },
  { name: "BBC Brit", code: "BBCBrit.se" },
  { name: "Cartoon Network", code: "CartoonNetwork.se" },
  { name: "Cartoonito", code: "Cartoonito.se" },
  { name: "Discovery Channel", code: "DiscoveryChannel.se" },
  { name: "Discovery Science", code: "DiscoveryScience.se" },
  { name: "Disney Channel", code: "DisneyChannel.se" },
  { name: "Eurosport 2", code: "Eurosport2.se" },
  { name: "Eurosport HD", code: "Eurosport.se" },
  { name: "Fight Sports", code: "FightSports.se" },
  { name: "Godare", code: "Godare.se" },
  { name: "H2HD", code: "HistoryChannel2.se" },
  { name: "History HD", code: "HistoryChannel.se" },
  { name: "Horse & Country TV", code: "HorseCountry.se" },
  { name: "Investigation Discovery", code: "InvestigationDiscovery.se" },
  { name: "Kanal 10", code: "Kanal10.se" },
  { name: "Kanal 11 HD", code: "Kanal11.se" },
  { name: "Kanal 5", code: "Kanal5.se" },
  { name: "Kanal 9", code: "Kanal9.se" },
  { name: "Kunskapskanalen", code: "Kunskapskanalen.se" },
  { name: "Love Nature HD (T)", code: "LoveNature.se" },
  { name: "Mezzo", code: "Mezzo.se" },
  { name: "Moonbug (T)", code: "Moonbug.se" },
  { name: "MTV", code: "MTV.se" },
  { name: "Nat Geo Wild", code: "NatGeoWild.se" },
  { name: "National Geographic", code: "NatGeo.se" },
  { name: "National Geographic HD (svenska)", code: "NatGeoHD.se" },
  { name: "Nick Jr", code: "NickJr.se" },
  { name: "Nickelodeon", code: "Nickelodeon.se" },
  { name: "Nicktoons", code: "Nicktoons.se" },
  { name: "Out TV", code: "OutTV.se" },
  { name: "Pink Plus", code: "PinkPlus.se" },
  { name: "SF-kanalen", code: "SFKanalen.se" },
  { name: "Sjuan", code: "Sjuan.se" },
  { name: "SkyShowtime 1", code: "SkyShowtime1.se" },
  { name: "SkyShowtime 2", code: "SkyShowtime2.se" },
  { name: "Sportkanalen", code: "Sportkanalen.se" },
  { name: "SVT 24", code: "svt24.se" },
  { name: "SVT Barn", code: "SVTb.se" },
  { name: "SVT1", code: "SVT1.se" },
  { name: "SVT2", code: "SVT2.se" },
  { name: "TLC", code: "TLCsverige.se" },
  { name: "TLC Europe", code: "TLCEurope.se" },
  { name: "Travel Channel", code: "TravelChannel.se" },
  { name: "TV 12", code: "TV12.se" },
  { name: "TV10", code: "TV10.se" },
  { name: "TV3", code: "TV3.se" },
  { name: "TV4", code: "TV4.se" },
  { name: "TV4 Fakta", code: "TV4Fakta.se" },
  { name: "TV4 Film", code: "TV4Film.se" },
  { name: "TV4 Fotboll", code: "TV4Fotboll.se" },
  { name: "TV4 Guld", code: "TV4Guld.se" },
  { name: "TV4 Hits", code: "TV4Hits.se" },
  { name: "TV4 Hockey", code: "TV4Hockey.se" },
  { name: "TV4 Motor", code: "TV4Motor.se" },
  { name: "TV4 Sport Live 1", code: "TV4SportLive1.se" },
  { name: "TV4 Sport Live 2", code: "TV4SportLive2.se" },
  { name: "TV4 Sport Live 3", code: "TV4SportLive3.se" },
  { name: "TV4 Sport Live 4", code: "TV4SportLive4.se" },
  { name: "TV4 Stars", code: "TV4Stars.se" },
  { name: "TV4 Tennis", code: "TV4Tennis.se" },
  { name: "TV6 HD", code: "TV6.se" },
  { name: "TV8", code: "TV8.se" },
  { name: "TVE", code: "TVE.se" },

  { name: "V Film Action", code: "ViasatFilmAction.se" },
  { name: "V Film Family", code: "ViasatFilmFamily.se" },
  { name: "V Film Hits", code: "ViasatFilmHits.se" },
  { name: "V Film Premiere", code: "ViasatFilmPremiere.se" },
  { name: "V Film Premiere HD", code: "ViasatFilmPremiere.se" },
  { name: "V Series", code: "ViasatSeries.se" },
  { name: "V Series HD", code: "ViasatSeries.se" },
  { name: "V Fotboll", code: "ViasatFotboll.se" },
  { name: "V Fotboll HD", code: "ViasatFotboll.se" },
  { name: "V Sport", code: "ViasatSport.se" },
  { name: "V Sport HD", code: "ViasatSport.se" },
  { name: "V Sport Premium", code: "ViasatSportPremium.se" },
  { name: "V Sport Premium HD", code: "ViasatSportPremium.se" },
  { name: "V Sport Premium FHD", code: "ViasatSportPremium.se" },
  { name: "Viasat Explore", code: "ViasatExplore.se" },

  { name: "V Sport Extra HD", code: "ViasatSportExtra.se" },
  { name: "V Sport Vinter", code: "ViasatSportVinter.se" },
  { name: "Viasat Explorer", code: "ViasatExplore.se" },
  { name: "Viasat Film Action", code: "ViasatFilmAction.se" },
  { name: "Viasat Film Family", code: "ViasatFilmFamily.se" },
  { name: "Viasat Film Hits", code: "ViasatFilmHits.se" },
  { name: "Viasat Film Premiere HD", code: "ViasatFilmPremiere.se" },
  { name: "Viasat Fotboll", code: "ViasatFotboll.se" },
  { name: "Viasat Golf", code: "ViasatGolf.se" },
  { name: "Viasat History", code: "ViasatHistory.se" },
  { name: "Viasat Motor", code: "ViasatMotor.se" },
  { name: "Viasat Nature/Crime", code: "ViasatNatureCrime.se" },
  { name: "Viasat Series HD", code: "ViasatSeries.se" },
  { name: "Viasat Sport", code: "ViasatSport.se" },
  { name: "Viasat Sport Premium HD", code: "ViasatSportPremium.se" },
  { name: "Vision Sverige", code: "VisionSverige.se" },
];

function ChannelLogo({
  logo,
  name,
  size = 22,
  onStatusChange,
}: {
  logo: string;
  name: string;
  size?: number;
  onStatusChange?: (status: LogoStatus) => void;
}) {
  const [failed, setFailed] = useState(false);
  const lastLogoRef = useRef("");

  useEffect(() => {
    if (lastLogoRef.current !== logo) {
      lastLogoRef.current = logo;
      setFailed(false);

      if (!logo) {
        onStatusChange?.("missing");
      }
    }
  }, [logo, onStatusChange]);

  const wrapperStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: 5,
    background: "#e5e7eb",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  if (!logo || failed) {
    return (
      <div className="channelIcon" style={wrapperStyle}>
        <ImageIcon size={Math.max(14, size - 8)} strokeWidth={2.2} />
      </div>
    );
  }

  return (
    <div className="channelIcon" style={wrapperStyle}>
      <img
        src={logo}
        alt={name}
        loading="lazy"
        onLoad={() => {
          onStatusChange?.("ok");
        }}
        onError={() => {
          setFailed(true);
          onStatusChange?.("broken");
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          padding: size >= 60 ? 4 : 1,
        }}
      />
    </div>
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeLogoUrl(value: string) {
  const decoded = decodeXmlEntities(value.trim());

  if (!decoded) {
    return "";
  }

  if (decoded.startsWith("http://")) {
    return `https://${decoded.slice("http://".length)}`;
  }

  return decoded;
}

function cleanNameForEpg(value: string) {
  let text = normalizeText(value);

  text = decodeXmlEntities(text);

  text = text.replace(/^[a-z]{2,5}\s*:\s*/i, "");

  text = text.replace(/\[[^\]]*\]/g, " ");
  text = text.replace(/\([^)]*\)/g, " ");
  text = text.replace(/\{[^}]*\}/g, " ");

  text = text.replace(/(\d)\s*(fhd|fullhd|full hd|uhd|hd|sd|4k|8k)\b/gi, "$1 ");
  text = text.replace(/([a-zåäö])\s*(fhd|fullhd|full hd|uhd|hd|sd|4k|8k)\b/gi, "$1 ");

  text = text.replace(/([a-zåäö])(\d)/gi, "$1 $2");
  text = text.replace(/(\d)([a-zåäö])/gi, "$1 $2");

  text = text.replace(
    /\b(fhd|fullhd|full hd|hd|uhd|4k|8k|sd|hevc|h265|h\.265|x265|x264|mpeg|1080p|720p|2160p|50fps|60fps)\b/gi,
    " "
  );

  text = text.replace(
    /\b(multi audio|multi-audio|multiaudio|dual audio|audio|subtitles|subtitle|subs)\b/gi,
    " "
  );

  text = text.replace(
    /\b(sweden|sverige|swedish|svensk|nordic|scandinavia|scandinavian|se|dk|no|fi)\b/gi,
    " "
  );

  text = text.replace(
    /\b(live|backup|alt|raw|custom|vip|test|new|old|copy)\b/gi,
    " "
  );

  text = text.replace(/[|•_\-–—]+/g, " ");
  text = text.replace(/[^\p{L}\p{N}&+ ]+/gu, " ");

  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function getAttribute(line: string, attribute: string): string {
  const match = line.match(new RegExp(`${attribute}="([^"]*)"`, "i"));
  return match?.[1]?.trim() || "";
}

function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("#EXTINF")) {
      const url = lines[i + 1]?.trim() || "";

      const lastCommaIndex = line.lastIndexOf(",");
      const channelName =
        lastCommaIndex >= 0
          ? line.substring(lastCommaIndex + 1).trim()
          : getAttribute(line, "tvg-name") || "Unnamed channel";

      const group = getAttribute(line, "group-title") || "No Group";

      channels.push({
        id: crypto.randomUUID(),
        name: channelName,
        group,
        url,
        rawInfo: line,
        tvgId: getAttribute(line, "tvg-id"),
        tvgName: getAttribute(line, "tvg-name"),
        tvgLogo: normalizeLogoUrl(getAttribute(line, "tvg-logo")),
      });
    }
  }

  return channels;
}

function parseEpgChannelBlock(block: string): EpgChannel | null {
  const idMatch = block.match(/<channel\b[^>]*\bid\s*=\s*"([^"]*)"/i);
  const id = decodeXmlEntities(idMatch?.[1]?.trim() || "");

  const names = Array.from(
    block.matchAll(/<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi)
  )
    .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, "").trim()))
    .filter(Boolean);

  const iconMatch = block.match(/<icon\b[^>]*\bsrc\s*=\s*"([^"]*)"/i);
  const logo = normalizeLogoUrl(iconMatch?.[1] || "");

  if (!id && names.length === 0 && !logo) {
    return null;
  }

  return {
    id,
    names,
    logo,
  };
}

async function readEpgChannelsFromFile(
  file: File,
  onProgress: (message: string) => void
): Promise<EpgChannel[]> {
  const isGzip = file.name.toLowerCase().endsWith(".gz");
  const canDecompress = typeof DecompressionStream !== "undefined" && isGzip;

  if (isGzip && !canDecompress) {
    throw new Error(
      "This browser does not support built-in .gz decompression. Try Edge/Chrome updated version, or extract the .xml.gz manually."
    );
  }

  const rawStream = file.stream();
  const stream = isGzip
    ? rawStream.pipeThrough(new DecompressionStream("gzip"))
    : rawStream;

  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");

  const epgChannels: EpgChannel[] = [];
  const seenIds = new Set<string>();
  let buffer = "";
  let stoppedAtProgramme = false;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const programmeIndex = buffer.search(/<programme\b/i);

    if (programmeIndex >= 0) {
      buffer = buffer.slice(0, programmeIndex);
      stoppedAtProgramme = true;
    }

    while (true) {
      const startIndex = buffer.search(/<channel\b/i);

      if (startIndex < 0) {
        if (buffer.length > 200000) {
          buffer = buffer.slice(-50000);
        }
        break;
      }

      const endMatch = buffer.slice(startIndex).match(/<\/channel>/i);

      if (!endMatch || endMatch.index === undefined) {
        buffer = buffer.slice(startIndex);
        break;
      }

      const endIndex = startIndex + endMatch.index + endMatch[0].length;
      const block = buffer.slice(startIndex, endIndex);
      const epgChannel = parseEpgChannelBlock(block);

      if (epgChannel) {
        const uniqueKey =
          epgChannel.id || `${epgChannel.names.join("|")}-${epgChannels.length}`;

        if (!seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          epgChannels.push(epgChannel);
        }
      }

      buffer = buffer.slice(endIndex);
    }

    if (epgChannels.length % 500 === 0 && epgChannels.length > 0) {
      onProgress(
        `Importing EPG... ${epgChannels.length.toLocaleString()} channels found`
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (stoppedAtProgramme) {
      break;
    }
  }

  while (true) {
    const startIndex = buffer.search(/<channel\b/i);

    if (startIndex < 0) {
      break;
    }

    const endMatch = buffer.slice(startIndex).match(/<\/channel>/i);

    if (!endMatch || endMatch.index === undefined) {
      break;
    }

    const endIndex = startIndex + endMatch.index + endMatch[0].length;
    const block = buffer.slice(startIndex, endIndex);
    const epgChannel = parseEpgChannelBlock(block);

    if (epgChannel) {
      const uniqueKey =
        epgChannel.id || `${epgChannel.names.join("|")}-${epgChannels.length}`;

      if (!seenIds.has(uniqueKey)) {
        seenIds.add(uniqueKey);
        epgChannels.push(epgChannel);
      }
    }

    buffer = buffer.slice(endIndex);
  }

  return epgChannels;
}
function buildEpgIndexes(epgChannels: EpgChannel[]): EpgIndexes {
  const byId = new Map<string, EpgChannel>();
  const byExactName = new Map<string, EpgChannel[]>();
  const byCleanName = new Map<string, EpgChannel[]>();

  for (const epgChannel of epgChannels) {
    if (epgChannel.id) {
      byId.set(normalizeText(epgChannel.id), epgChannel);

      const cleanId = cleanNameForEpg(epgChannel.id);

      if (cleanId) {
        if (!byCleanName.has(cleanId)) {
          byCleanName.set(cleanId, []);
        }

        byCleanName.get(cleanId)?.push(epgChannel);
      }
    }

    for (const name of epgChannel.names) {
      const exactKey = normalizeText(name);
      const cleanKey = cleanNameForEpg(name);

      if (exactKey) {
        if (!byExactName.has(exactKey)) {
          byExactName.set(exactKey, []);
        }

        byExactName.get(exactKey)?.push(epgChannel);
      }

      if (cleanKey) {
        if (!byCleanName.has(cleanKey)) {
          byCleanName.set(cleanKey, []);
        }

        byCleanName.get(cleanKey)?.push(epgChannel);
      }
    }
  }

  return {
    byId,
    byExactName,
    byCleanName,
  };
}

function findSmartEpgNameMatch(
  channelNames: string[],
  epgIndexes: EpgIndexes
): EpgChannel | null {
  const cleanedChannelNames = channelNames
    .map(cleanNameForEpg)
    .filter((name) => name.length >= 2);

  for (const cleanedName of cleanedChannelNames) {
    const directMatches = epgIndexes.byCleanName.get(cleanedName);

    if (directMatches && directMatches.length > 0) {
      return directMatches[0];
    }
  }

  for (const cleanedName of cleanedChannelNames) {
    for (const [epgCleanName, matches] of epgIndexes.byCleanName.entries()) {
      if (!epgCleanName || matches.length === 0) {
        continue;
      }

      if (epgCleanName.length < 3 || cleanedName.length < 3) {
        continue;
      }

      if (
        cleanedName === epgCleanName ||
        cleanedName.includes(epgCleanName) ||
        epgCleanName.includes(cleanedName)
      ) {
        return matches[0];
      }
    }
  }

  for (const cleanedName of cleanedChannelNames) {
    const channelTokens = cleanedName
      .split(" ")
      .filter((token) => token.length >= 2);

    if (channelTokens.length === 0) {
      continue;
    }

    for (const [epgCleanName, matches] of epgIndexes.byCleanName.entries()) {
      const epgTokens = epgCleanName
        .split(" ")
        .filter((token) => token.length >= 2);

      if (epgTokens.length === 0 || matches.length === 0) {
        continue;
      }

      const commonTokens = channelTokens.filter((token) =>
        epgTokens.includes(token)
      );

      const requiredMatches = Math.min(channelTokens.length, epgTokens.length);

      if (commonTokens.length >= requiredMatches && commonTokens.length >= 1) {
        return matches[0];
      }
    }
  }

  return null;
}

function getEpgMatchForChannel(
  channel: Channel,
  epgChannels: EpgChannel[],
  epgIndexes: EpgIndexes,
  epgTargetGroup: string
): EpgMatch {
  if (epgChannels.length === 0) {
    return {
      status: "no-epg",
      epgChannel: null,
    };
  }

  if (epgTargetGroup !== "All Channels" && channel.group !== epgTargetGroup) {
    return {
      status: "not-target-group",
      epgChannel: null,
    };
  }

  const normalizedTvgId = normalizeText(channel.tvgId);

  if (normalizedTvgId) {
    const exactIdMatch = epgIndexes.byId.get(normalizedTvgId);

    if (exactIdMatch) {
      return {
        status: "matched-id",
        epgChannel: exactIdMatch,
      };
    }
  }

  const possibleNames = [channel.tvgName, channel.name].filter(Boolean);

  for (const name of possibleNames) {
    const exactMatches = epgIndexes.byExactName.get(normalizeText(name));

    if (exactMatches && exactMatches.length > 0) {
      return {
        status: "matched-name",
        epgChannel: exactMatches[0],
      };
    }
  }

  const smartMatch = findSmartEpgNameMatch(possibleNames, epgIndexes);

  if (smartMatch) {
    return {
      status: "matched-name",
      epgChannel: smartMatch,
    };
  }

  if (normalizedTvgId) {
    return {
      status: "missing-id",
      epgChannel: null,
    };
  }

  return {
    status: "empty-id",
    epgChannel: null,
  };
}

function calculateEpgStatsForTarget(
  channels: Channel[],
  epgChannels: EpgChannel[],
  epgTargetGroup: string
) {
  const indexes = buildEpgIndexes(epgChannels);

  let targetChannels = 0;
  let matched = 0;
  let possible = 0;
  let missing = 0;
  let empty = 0;

  for (const channel of channels) {
    if (epgTargetGroup !== "All Channels" && channel.group !== epgTargetGroup) {
      continue;
    }

    targetChannels++;

    const match = getEpgMatchForChannel(
      channel,
      epgChannels,
      indexes,
      epgTargetGroup
    );

    if (match.status === "matched-id") matched++;
    if (match.status === "matched-name") possible++;
    if (match.status === "missing-id") missing++;
    if (match.status === "empty-id") empty++;
  }

  return {
    targetChannels,
    matched,
    possible,
    missing,
    empty,
  };
}

function setAttribute(line: string, attribute: string, value: string): string {
  const escapedValue = value.replace(/"/g, "&quot;");
  const attributePattern = new RegExp(`${attribute}="[^"]*"`, "i");

  if (attributePattern.test(line)) {
    return line.replace(attributePattern, `${attribute}="${escapedValue}"`);
  }

  const commaIndex = line.lastIndexOf(",");

  if (commaIndex >= 0) {
    return (
      line.slice(0, commaIndex) +
      ` ${attribute}="${escapedValue}"` +
      line.slice(commaIndex)
    );
  }

  return `${line} ${attribute}="${escapedValue}"`;
}

function updateChannelNameInRawInfo(rawInfo: string, newName: string): string {
  const commaIndex = rawInfo.lastIndexOf(",");

  if (commaIndex >= 0) {
    return `${rawInfo.slice(0, commaIndex + 1)}${newName}`;
  }

  return `${rawInfo},${newName}`;
}

function updateGroupInRawInfo(rawInfo: string, newGroup: string): string {
  return setAttribute(rawInfo, "group-title", newGroup);
}

function updateChannelRawInfo(channel: Channel): string {
  let line = channel.rawInfo;

  line = updateChannelNameInRawInfo(line, channel.name);
  line = setAttribute(line, "group-title", channel.group);
  line = setAttribute(line, "tvg-id", channel.tvgId);
  line = setAttribute(line, "tvg-name", channel.tvgName);
  line = setAttribute(line, "tvg-logo", channel.tvgLogo);

  return line;
}

function cloneChannels(channels: Channel[]) {
  return channels.map((channel) => ({ ...channel }));
}

function cloneSnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return {
    channels: cloneChannels(snapshot.channels),
    groupOrder: [...snapshot.groupOrder],
    selectedGroup: snapshot.selectedGroup,
    epgTargetGroup: snapshot.epgTargetGroup,
  };
}

function makeSafeFileName(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function exportM3U(channels: Channel[], originalFileName: string) {
  let output = "#EXTM3U\n";

  for (const channel of channels) {
    const updatedInfo = updateChannelRawInfo(channel);
    output += `${updatedInfo}\n${channel.url}\n`;
  }

  const blob = new Blob([output], { type: "audio/x-mpegurl;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const cleanName = originalFileName
    ? originalFileName.replace(/\.(m3u8?|txt)$/i, "")
    : "playlist";

  const link = document.createElement("a");
  link.href = url;
  link.download = `${cleanName}-edited.m3u`;
  link.click();

  URL.revokeObjectURL(url);
}

function exportM3UWithName(channels: Channel[], downloadName: string) {
  let output = "#EXTM3U\n";

  for (const channel of channels) {
    const updatedInfo = updateChannelRawInfo(channel);
    output += `${updatedInfo}\n${channel.url}\n`;
  }

  const blob = new Blob([output], { type: "audio/x-mpegurl;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  link.click();

  URL.revokeObjectURL(url);
}

function createDragPreview(text: string) {
  const preview = document.createElement("div");
  preview.className = "dragPreview";
  preview.textContent = text;
  document.body.appendChild(preview);
  return preview;
}

function getRowDropPosition(
  event: DragEvent<HTMLDivElement | HTMLButtonElement>
): "above" | "below" {
  const rect = event.currentTarget.getBoundingClientRect();
  const middle = rect.top + rect.height / 2;
  return event.clientY < middle ? "above" : "below";
}

function moveItemsNearTarget(
  channels: Channel[],
  draggedIds: string[],
  targetId: string,
  position: "above" | "below"
): Channel[] {
  if (draggedIds.includes(targetId)) {
    return channels;
  }

  const draggedSet = new Set(draggedIds);
  const draggedItems = channels.filter((channel) => draggedSet.has(channel.id));
  const remainingItems = channels.filter((channel) => !draggedSet.has(channel.id));

  const targetIndex = remainingItems.findIndex(
    (channel) => channel.id === targetId
  );

  if (targetIndex < 0) {
    return channels;
  }

  const insertIndex = position === "below" ? targetIndex + 1 : targetIndex;

  return [
    ...remainingItems.slice(0, insertIndex),
    ...draggedItems,
    ...remainingItems.slice(insertIndex),
  ];
}

function insertChannelsAtBottomOfGroup(
  current: Channel[],
  itemsToInsert: Channel[],
  targetGroup: string,
  removeIds: string[] = []
): Channel[] {
  const removeSet = new Set(removeIds);
  const remaining = current.filter((channel) => !removeSet.has(channel.id));

  const lastTargetGroupIndex = remaining
    .map((channel) => channel.group)
    .lastIndexOf(targetGroup);

  if (lastTargetGroupIndex === -1) {
    return [...remaining, ...itemsToInsert];
  }

  return [
    ...remaining.slice(0, lastTargetGroupIndex + 1),
    ...itemsToInsert,
    ...remaining.slice(lastTargetGroupIndex + 1),
  ];
}

function reorderArrayItem(
  items: string[],
  draggedItem: string,
  targetItem: string,
  position: "above" | "below"
): string[] {
  if (draggedItem === targetItem) {
    return items;
  }

  const withoutDragged = items.filter((item) => item !== draggedItem);
  const targetIndex = withoutDragged.indexOf(targetItem);

  if (targetIndex === -1) {
    return items;
  }

  const insertIndex = position === "below" ? targetIndex + 1 : targetIndex;

  return [
    ...withoutDragged.slice(0, insertIndex),
    draggedItem,
    ...withoutDragged.slice(insertIndex),
  ];
}

function reorderMultipleGroups(
  items: string[],
  draggedItems: string[],
  targetItem: string,
  position: "above" | "below"
): string[] {
  const draggedSet = new Set(draggedItems);

  if (draggedSet.has(targetItem)) {
    return items;
  }

  const movingItems = items.filter((item) => draggedSet.has(item));
  const remainingItems = items.filter((item) => !draggedSet.has(item));

  const targetIndex = remainingItems.indexOf(targetItem);

  if (targetIndex === -1) {
    return items;
  }

  const insertIndex = position === "below" ? targetIndex + 1 : targetIndex;

  return [
    ...remainingItems.slice(0, insertIndex),
    ...movingItems,
    ...remainingItems.slice(insertIndex),
  ];
}

function reorderChannelsByGroupOrder(
  channels: Channel[],
  groupOrder: string[]
): Channel[] {
  const groupPosition = new Map<string, number>();

  groupOrder.forEach((group, index) => {
    groupPosition.set(group, index);
  });

  return [...channels].sort((a, b) => {
    const aIndex = groupPosition.get(a.group) ?? 999999;
    const bIndex = groupPosition.get(b.group) ?? 999999;

    return aIndex - bIndex;
  });
}

function moveSelectedGroupsToTop(order: string[], selected: string[]) {
  const selectedSet = new Set(selected);

  return [
    ...order.filter((group) => selectedSet.has(group)),
    ...order.filter((group) => !selectedSet.has(group)),
  ];
}

function moveSelectedGroupsToBottom(order: string[], selected: string[]) {
  const selectedSet = new Set(selected);

  return [
    ...order.filter((group) => !selectedSet.has(group)),
    ...order.filter((group) => selectedSet.has(group)),
  ];
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();

  if (tag === "textarea" || tag === "select" || target.isContentEditable) {
    return true;
  }

  if (tag === "input") {
    const input = target as HTMLInputElement;
    const type = input.type.toLowerCase();

    return !["checkbox", "radio", "button", "submit"].includes(type);
  }

  return false;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bulkRenameName(name: string, form: BulkRenameForm) {
  let nextName = name;
  const find = form.find;

  if (find) {
    if (form.mode === "contains") {
      if (form.caseSensitive) {
        nextName = nextName.split(find).join(form.replace);
      } else {
        nextName = nextName.replace(
          new RegExp(escapeRegExp(find), "gi"),
          form.replace
        );
      }
    }

    if (form.mode === "begins") {
      const compareName = form.caseSensitive ? nextName : nextName.toLowerCase();
      const compareFind = form.caseSensitive ? find : find.toLowerCase();

      if (compareName.startsWith(compareFind)) {
        nextName = form.replace + nextName.slice(find.length);
      }
    }

    if (form.mode === "ends") {
      const compareName = form.caseSensitive ? nextName : nextName.toLowerCase();
      const compareFind = form.caseSensitive ? find : find.toLowerCase();

      if (compareName.endsWith(compareFind)) {
        nextName = nextName.slice(0, nextName.length - find.length) + form.replace;
      }
    }
  }

  nextName = `${form.prefix}${nextName}${form.suffix}`;

  return nextName.trim() || name;
}

function getEpgBadgeStyle(match: EpgMatch) {
  if (match.status === "matched-id") {
    return {
      text: "XML EPG",
      background: "#dcfce7",
      color: "#166534",
      title: "EPG matched by imported XML tvg-id",
    };
  }

  if (match.status === "matched-name") {
    return {
      text: "XML EPG?",
      background: "#fef9c3",
      color: "#854d0e",
      title: "Possible EPG match by imported XML smart name matching",
    };
  }

  if (match.status === "missing-id") {
    return {
      text: "NO XML EPG",
      background: "#fee2e2",
      color: "#991b1b",
      title: "tvg-id was not found in imported XML",
    };
  }

  if (match.status === "empty-id") {
    return {
      text: "NO ID",
      background: "#e5e7eb",
      color: "#374151",
      title: "No tvg-id found",
    };
  }

  return {
    text: "",
    background: "transparent",
    color: "transparent",
    title: "",
  };
}

function compactForEpgIdMatch(value: string) {
  return cleanNameForEpg(value)
    .replace(/\b(sverige|sweden|se|hd|fhd|uhd|sd|fullhd|full hd)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

function findBuiltInSwedishEpgCode(channel: Channel): BuiltInEpgCode | null {
  const channelCandidates = [
    channel.tvgName,
    channel.name,
    channel.name.replace(/^se\s*[:|-]\s*/i, ""),
  ]
    .filter(Boolean)
    .map(compactForEpgIdMatch)
    .filter(Boolean);

  const sortedCodes = [...SWEDISH_EPG_CODES].sort((a, b) => {
    return compactForEpgIdMatch(b.name).length - compactForEpgIdMatch(a.name).length;
  });

  for (const candidate of channelCandidates) {
    for (const item of sortedCodes) {
      const itemClean = compactForEpgIdMatch(item.name);
      const codeClean = compactForEpgIdMatch(item.code.replace(/\.se$/i, ""));

      if (candidate === itemClean || candidate === codeClean) {
        return item;
      }
    }
  }

  for (const candidate of channelCandidates) {
    for (const item of sortedCodes) {
      const itemClean = compactForEpgIdMatch(item.name);
      const codeClean = compactForEpgIdMatch(item.code.replace(/\.se$/i, ""));

      if (
        candidate.includes(itemClean) ||
        itemClean.includes(candidate) ||
        candidate.includes(codeClean) ||
        codeClean.includes(candidate)
      ) {
        return item;
      }
    }
  }

  return null;
}

function getLogoBadgeStyle(channel: Channel, isBroken: boolean) {
  if (!channel.tvgLogo) {
    return {
      text: "NO LOGO",
      background: "#e5e7eb",
      color: "#374151",
      title: "No tvg-logo URL found",
    };
  }

  if (isBroken) {
    return {
      text: "BROKEN LOGO",
      background: "#fee2e2",
      color: "#991b1b",
      title: "Logo URL exists, but the image could not be loaded",
    };
  }

  return {
    text: "LOGO",
    background: "#dbeafe",
    color: "#1e40af",
    title: "Logo URL found",
  };
}

function getIdBadgeStyle(channel: Channel) {
  if (channel.tvgId.trim()) {
    return {
      text: "ID OK",
      background: "#dcfce7",
      color: "#166534",
      title: `EPG ID exists: ${channel.tvgId}`,
    };
  }

  return {
    text: "NO ID",
    background: "#e5e7eb",
    color: "#374151",
    title: "No tvg-id found",
  };
}

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [epgChannels, setEpgChannels] = useState<EpgChannel[]>([]);
  const [epgImportStatus, setEpgImportStatus] = useState("");
  const [epgTargetGroup, setEpgTargetGroup] = useState("All Channels");
  const [pendingEpgFile, setPendingEpgFile] = useState<File | null>(null);
  const [pendingEpgTargetGroup, setPendingEpgTargetGroup] =
    useState("All Channels");
  const [epgTargetModalOpen, setEpgTargetModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("All Channels");
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [lastSelectedChannelId, setLastSelectedChannelId] = useState("");
  const [lastSelectedGroupName, setLastSelectedGroupName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [searchText, setSearchText] = useState("");
  const [logoFilter, setLogoFilter] = useState<LogoFilter>("all");
  const [brokenLogoIds, setBrokenLogoIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedChannelIds, setDraggedChannelIds] = useState<string[]>([]);
  const [dragOverGroup, setDragOverGroup] = useState("");
  const [draggedGroup, setDraggedGroup] = useState("");
  const [draggedGroupNames, setDraggedGroupNames] = useState<string[]>([]);
  const [groupDropTarget, setGroupDropTarget] = useState<GroupDropTarget | null>(
    null
  );
  const [openMenu, setOpenMenu] = useState<"group" | "channel" | null>(null);
  const [groupPickerMode, setGroupPickerMode] =
    useState<GroupPickerMode | null>(null);
  const [groupPickerSearch, setGroupPickerSearch] = useState("");
  const [renameGroupOpen, setRenameGroupOpen] = useState(false);
  const [renameGroupValue, setRenameGroupValue] = useState("");
  const [channelEditOpen, setChannelEditOpen] = useState(false);
  const [channelEditForm, setChannelEditForm] = useState<ChannelEditForm | null>(
    null
  );
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [epgModalOpen, setEpgModalOpen] = useState(false);
  const [epgSearch, setEpgSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(
    null
  );
  const [bulkRenameOpen, setBulkRenameOpen] = useState(false);
  const [bulkRenameForm, setBulkRenameForm] = useState<BulkRenameForm>({
    prefix: "",
    suffix: "",
    find: "",
    replace: "",
    caseSensitive: false,
    mode: "contains",
  });

  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const channelListRef = useRef<HTMLDivElement | null>(null);
  const dropIndicatorRef = useRef<HTMLDivElement | null>(null);
  const currentDropTargetRef = useRef<DropTarget | null>(null);

  const brokenLogoSet = useMemo(() => {
    return new Set(brokenLogoIds);
  }, [brokenLogoIds]);

  const selectedChannelSet = useMemo(() => {
    return new Set(selectedChannelIds);
  }, [selectedChannelIds]);

  const selectedGroupSet = useMemo(() => {
    return new Set(selectedGroupNames);
  }, [selectedGroupNames]);

  const logoStats = useMemo(() => {
    let withLogo = 0;
    let missingLogo = 0;
    let brokenLogo = 0;

    for (const channel of channels) {
      if (!channel.tvgLogo) {
        missingLogo++;
      } else {
        withLogo++;
      }

      if (brokenLogoSet.has(channel.id)) {
        brokenLogo++;
      }
    }

    return {
      withLogo,
      missingLogo,
      brokenLogo,
    };
  }, [channels, brokenLogoSet]);

  const selectedLogoChannel = useMemo(() => {
    if (selectedChannelIds.length !== 1) {
      return null;
    }

    return channels.find((channel) => channel.id === selectedChannelIds[0]) || null;
  }, [channels, selectedChannelIds]);

  const selectedEpgChannel = selectedLogoChannel;
  const groupsFromChannels = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const channel of channels) {
      if (!seen.has(channel.group)) {
        seen.add(channel.group);
        result.push(channel.group);
      }
    }

    return result;
  }, [channels]);

  const groups = useMemo(() => {
    const merged = [...groupOrder];

    for (const group of groupsFromChannels) {
      if (!merged.includes(group)) {
        merged.push(group);
      }
    }

    return merged;
  }, [groupOrder, groupsFromChannels]);

  const epgIndexes = useMemo(() => {
    return buildEpgIndexes(epgChannels);
  }, [epgChannels]);

  const epgMatchMap = useMemo(() => {
    const result = new Map<string, EpgMatch>();

    for (const channel of channels) {
      result.set(
        channel.id,
        getEpgMatchForChannel(channel, epgChannels, epgIndexes, epgTargetGroup)
      );
    }

    return result;
  }, [channels, epgChannels, epgIndexes, epgTargetGroup]);

  const epgStats = useMemo(() => {
    return calculateEpgStatsForTarget(channels, epgChannels, epgTargetGroup);
  }, [channels, epgChannels, epgTargetGroup]);

  const epgSearchResults = useMemo(() => {
    const selected = selectedEpgChannel;
    const search =
      epgSearch.trim() ||
      selected?.tvgName ||
      selected?.name ||
      selected?.tvgId ||
      "";

    const normalizedSearch = normalizeText(search);
    const cleanedSearch = cleanNameForEpg(search);

    if (!normalizedSearch && !cleanedSearch) {
      return epgChannels.slice(0, 80);
    }

    return epgChannels
      .filter((epgChannel) => {
        const id = normalizeText(epgChannel.id);
        const cleanId = cleanNameForEpg(epgChannel.id);

        if (id.includes(normalizedSearch) || cleanId.includes(cleanedSearch)) {
          return true;
        }

        return epgChannel.names.some((name) => {
          const exactName = normalizeText(name);
          const cleanName = cleanNameForEpg(name);

          return (
            exactName.includes(normalizedSearch) ||
            cleanName.includes(cleanedSearch)
          );
        });
      })
      .slice(0, 80);
  }, [epgChannels, epgSearch, selectedEpgChannel]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const channel of channels) {
      counts.set(channel.group, (counts.get(channel.group) || 0) + 1);
    }

    return counts;
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return channels.filter((channel) => {
      const matchesGroup =
        selectedGroup === "All Channels" || channel.group === selectedGroup;

      if (!matchesGroup) {
        return false;
      }

      if (
        logoFilter === "has-logo" &&
        (!channel.tvgLogo || brokenLogoSet.has(channel.id))
      ) {
        return false;
      }

      if (logoFilter === "missing-logo" && channel.tvgLogo) {
        return false;
      }

      if (logoFilter === "broken-logo" && !brokenLogoSet.has(channel.id)) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        channel.name.toLowerCase().includes(search) ||
        channel.group.toLowerCase().includes(search) ||
        channel.url.toLowerCase().includes(search) ||
        channel.tvgId.toLowerCase().includes(search) ||
        channel.tvgName.toLowerCase().includes(search) ||
        channel.tvgLogo.toLowerCase().includes(search)
      );
    });
  }, [channels, selectedGroup, searchText, logoFilter, brokenLogoSet]);

  const visibleChannels = filteredChannels.slice(0, 1000);

  const allVisibleSelected =
    visibleChannels.length > 0 &&
    visibleChannels.every((channel) => selectedChannelSet.has(channel.id));

  const allGroupsSelected =
    groups.length > 0 && groups.every((group) => selectedGroupSet.has(group));

  const groupPickerGroups = useMemo(() => {
    const search = groupPickerSearch.trim().toLowerCase();

    if (!search) {
      return groups;
    }

    return groups.filter((group) => group.toLowerCase().includes(search));
  }, [groups, groupPickerSearch]);

  const groupActionTargets =
    selectedGroupNames.length > 0
      ? selectedGroupNames
      : selectedGroup !== "All Channels"
        ? [selectedGroup]
        : [];

  const deleteGroupChannelCount = useMemo(() => {
    if (!deleteConfirm) {
      return 0;
    }

    return channels.filter((channel) =>
      deleteConfirm.groupNames.includes(channel.group)
    ).length;
  }, [channels, deleteConfirm]);

  const bulkRenameHasChanges =
    bulkRenameForm.prefix.trim() ||
    bulkRenameForm.suffix.trim() ||
    bulkRenameForm.find.trim();

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  function makeSnapshot(): HistorySnapshot {
    return {
      channels: cloneChannels(channels),
      groupOrder: [...groupOrder],
      selectedGroup,
      epgTargetGroup,
    };
  }

  function pushUndoSnapshot() {
    const snapshot = makeSnapshot();

    setUndoStack((current) => {
      const next = [...current, snapshot];
      return next.slice(-MAX_HISTORY_STEPS);
    });

    setRedoStack([]);
  }

  function restoreSnapshot(snapshot: HistorySnapshot) {
    const cloned = cloneSnapshot(snapshot);

    setChannels(cloned.channels);
    setGroupOrder(cloned.groupOrder);
    setSelectedGroup(cloned.selectedGroup);
    setEpgTargetGroup(cloned.epgTargetGroup);

    setSelectedChannelIds([]);
    setSelectedGroupNames([]);
    setLastSelectedChannelId("");
    setLastSelectedGroupName("");
    setBrokenLogoIds([]);
    closeFloatingMenus();
    resetDragState();
  }

  function undoLastAction() {
    if (undoStack.length === 0) {
      return;
    }

    const previous = undoStack[undoStack.length - 1];
    const currentSnapshot = makeSnapshot();

    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, currentSnapshot].slice(-MAX_HISTORY_STEPS));
    restoreSnapshot(previous);
  }

  function redoLastAction() {
    if (redoStack.length === 0) {
      return;
    }

    const next = redoStack[redoStack.length - 1];
    const currentSnapshot = makeSnapshot();

    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, currentSnapshot].slice(-MAX_HISTORY_STEPS));
    restoreSnapshot(next);
  }

  function closeFloatingMenus() {
    setOpenMenu(null);
    setContextMenu(null);
  }

  function markLogoStatus(channelId: string, status: LogoStatus) {
    setBrokenLogoIds((current) => {
      const exists = current.includes(channelId);

      if (status === "broken") {
        if (exists) {
          return current;
        }

        return [...current, channelId];
      }

      if (!exists) {
        return current;
      }

      return current.filter((id) => id !== channelId);
    });
  }

  function selectChannelWithEvent(
    channelId: string,
    event?: ReactMouseEvent<HTMLElement>
  ) {
    if (event?.shiftKey && lastSelectedChannelId) {
      const startIndex = visibleChannels.findIndex(
        (channel) => channel.id === lastSelectedChannelId
      );
      const endIndex = visibleChannels.findIndex(
        (channel) => channel.id === channelId
      );

      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        const rangeIds = visibleChannels
          .slice(from, to + 1)
          .map((channel) => channel.id);

        setSelectedChannelIds((current) => {
          const merged = new Set([...current, ...rangeIds]);
          return Array.from(merged);
        });

        setLastSelectedChannelId(channelId);
        return;
      }
    }

    setSelectedChannelIds((current) => {
      if (current.includes(channelId)) {
        return current.filter((id) => id !== channelId);
      }

      return [...current, channelId];
    });

    setLastSelectedChannelId(channelId);
  }

  function selectGroupWithEvent(
    groupName: string,
    event?: ReactMouseEvent<HTMLElement>
  ) {
    if (event?.shiftKey && lastSelectedGroupName) {
      const startIndex = groups.indexOf(lastSelectedGroupName);
      const endIndex = groups.indexOf(groupName);

      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        const rangeGroups = groups.slice(from, to + 1);

        setSelectedGroupNames((current) => {
          const merged = new Set([...current, ...rangeGroups]);
          return Array.from(merged);
        });

        setLastSelectedGroupName(groupName);
        return;
      }
    }

    setSelectedGroupNames((current) => {
      if (current.includes(groupName)) {
        return current.filter((group) => group !== groupName);
      }

      return [...current, groupName];
    });

    setLastSelectedGroupName(groupName);
  }

  function showDropIndicator(
    event: DragEvent<HTMLDivElement>,
    channelId: string
  ) {
    const list = channelListRef.current;
    const indicator = dropIndicatorRef.current;

    if (!list || !indicator) {
      return;
    }

    const position = getRowDropPosition(event);
    const row = event.currentTarget;
    const y = row.offsetTop + (position === "below" ? row.offsetHeight : 0);

    currentDropTargetRef.current = {
      channelId,
      position,
    };

    indicator.style.display = "block";
    indicator.style.transform = `translateY(${y - 2}px)`;
  }

  function hideDropIndicator() {
    currentDropTargetRef.current = null;

    if (dropIndicatorRef.current) {
      dropIndicatorRef.current.style.display = "none";
    }
  }

  function resetDragState() {
    setDraggedChannelIds([]);
    setDraggedGroup("");
    setDraggedGroupNames([]);
    setDragOverGroup("");
    setGroupDropTarget(null);
    hideDropIndicator();
  }

  function getInitialGroups(parsedChannels: Channel[]) {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const channel of parsedChannels) {
      if (!seen.has(channel.group)) {
        seen.add(channel.group);
        result.push(channel.group);
      }
    }

    return result;
  }

  function handleFile(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");
      const parsedChannels = parseM3U(text);
      const initialGroups = getInitialGroups(parsedChannels);

      setChannels(parsedChannels);
      setGroupOrder(initialGroups);
      setFileName(file.name);
      setSelectedGroup("All Channels");
      setEpgTargetGroup("All Channels");
      setPendingEpgTargetGroup("All Channels");
      setLogoFilter("all");
      setBrokenLogoIds([]);
      setSelectedGroupNames([]);
      setSelectedChannelIds([]);
      setLastSelectedChannelId("");
      setLastSelectedGroupName("");
      setSearchText("");
      setNewGroupName("");
      setLogoPreviewOpen(false);
      setEpgModalOpen(false);
      setDeleteConfirm(null);
      setBulkRenameOpen(false);
      setContextMenu(null);
      setUndoStack([]);
      setRedoStack([]);
      resetDragState();
    };

    reader.readAsText(file);
  }

  function chooseEpgFile(file: File) {
    setPendingEpgFile(file);
    setPendingEpgTargetGroup(selectedGroup || "All Channels");
    setEpgTargetModalOpen(true);
  }

  async function importPendingEpgFile() {
    if (!pendingEpgFile) {
      return;
    }

    const file = pendingEpgFile;
    const targetGroup = pendingEpgTargetGroup;

    setEpgTargetModalOpen(false);
    setPendingEpgFile(null);
    setEpgTargetGroup(targetGroup);

    try {
      setEpgImportStatus("Preparing EPG import...");
      setEpgChannels([]);

      const parsedEpgChannels = await readEpgChannelsFromFile(file, (message) => {
        setEpgImportStatus(message);
      });

      const stats = calculateEpgStatsForTarget(
        channels,
        parsedEpgChannels,
        targetGroup
      );

      setEpgChannels(parsedEpgChannels);
      setEpgImportStatus("");

      if (parsedEpgChannels.length === 0) {
        window.alert("EPG imported, but no channels were found.");
      } else {
        window.alert(
          `EPG imported successfully.\n\n` +
            `${parsedEpgChannels.length.toLocaleString()} EPG channels found.\n\n` +
            `Target group: ${targetGroup}\n` +
            `M3U channels checked: ${stats.targetChannels.toLocaleString()}\n` +
            `Matched by tvg-id: ${stats.matched.toLocaleString()}\n` +
            `Possible smart name matches: ${stats.possible.toLocaleString()}\n` +
            `Missing / unmatched: ${(stats.missing + stats.empty).toLocaleString()}`
        );
      }
    } catch (error) {
      setEpgImportStatus("");

      const message =
        error instanceof Error
          ? error.message
          : "Could not import EPG XML/XML.GZ file.";

      window.alert(message);
    }
  }

  function cancelPendingEpgImport() {
    setPendingEpgFile(null);
    setPendingEpgTargetGroup("All Channels");
    setEpgTargetModalOpen(false);
  }

  function toggleAllGroups() {
    if (allGroupsSelected) {
      setSelectedGroupNames([]);
      return;
    }

    setSelectedGroupNames(groups);
  }

  function toggleAllVisible() {
    const visibleIds = visibleChannels.map((channel) => channel.id);

    if (allVisibleSelected) {
      setSelectedChannelIds((current) =>
        current.filter((id) => !visibleIds.includes(id))
      );
      return;
    }

    setSelectedChannelIds((current) => {
      const merged = new Set([...current, ...visibleIds]);
      return Array.from(merged);
    });
  }

  function clearSelection() {
    setSelectedChannelIds([]);
    setSelectedGroupNames([]);
  }

  function addEmptyGroup(groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName) {
      return;
    }

    if (groups.includes(cleanGroupName)) {
      setSelectedGroup(cleanGroupName);
      return;
    }

    pushUndoSnapshot();
    setGroupOrder((current) => [cleanGroupName, ...current]);
    setSelectedGroup(cleanGroupName);
    setSelectedGroupNames([cleanGroupName]);
    setLastSelectedGroupName(cleanGroupName);
  }

  function addGroupFromButton() {
    const groupName = window.prompt("New group name:");

    if (!groupName) {
      return;
    }

    addEmptyGroup(groupName);
  }

  function renameGroup(oldGroupName: string, newGroupNameValue: string) {
    const cleanNewName = newGroupNameValue.trim();

    if (!cleanNewName || oldGroupName === "All Channels") {
      return;
    }

    if (groups.includes(cleanNewName) && cleanNewName !== oldGroupName) {
      window.alert("That group name already exists.");
      return;
    }

    pushUndoSnapshot();

    setChannels((current) =>
      current.map((channel) =>
        channel.group === oldGroupName
          ? {
              ...channel,
              group: cleanNewName,
              rawInfo: updateGroupInRawInfo(channel.rawInfo, cleanNewName),
            }
          : channel
      )
    );

    setGroupOrder((current) =>
      current.map((group) => (group === oldGroupName ? cleanNewName : group))
    );

    if (epgTargetGroup === oldGroupName) {
      setEpgTargetGroup(cleanNewName);
    }

    setSelectedGroup(cleanNewName);
    setSelectedGroupNames([cleanNewName]);
    setLastSelectedGroupName(cleanNewName);
    setRenameGroupOpen(false);
    setRenameGroupValue("");
  }

  function performDelete(channelIds: string[], groupNames: string[]) {
    const channelIdSet = new Set(channelIds);
    const groupNameSet = new Set(groupNames);

    pushUndoSnapshot();

    setChannels((current) =>
      current.filter(
        (channel) =>
          !channelIdSet.has(channel.id) && !groupNameSet.has(channel.group)
      )
    );

    setBrokenLogoIds((current) =>
      current.filter((id) => !channelIdSet.has(id))
    );

    if (groupNames.length > 0) {
      setGroupOrder((current) =>
        current.filter((group) => !groupNameSet.has(group))
      );

      if (groupNameSet.has(selectedGroup)) {
        setSelectedGroup("All Channels");
      }

      if (groupNameSet.has(epgTargetGroup)) {
        setEpgTargetGroup("All Channels");
      }
    }

    setSelectedChannelIds([]);
    setSelectedGroupNames([]);
    setLastSelectedChannelId("");
    setLastSelectedGroupName("");
    closeFloatingMenus();
    setDeleteConfirm(null);
  }

  function requestDelete(channelIds: string[], groupNames: string[]) {
    if (channelIds.length === 0 && groupNames.length === 0) {
      return;
    }

    closeFloatingMenus();
    setDeleteConfirm({
      channelIds,
      groupNames,
    });
  }

  function exportGroups(groupNames: string[]) {
    const cleanGroups = Array.from(
      new Set(groupNames.filter((group) => group && group !== "All Channels"))
    );

    if (cleanGroups.length === 0) {
      return;
    }

    const groupSet = new Set(cleanGroups);
    const exportChannels = channels.filter((channel) => groupSet.has(channel.group));

    if (exportChannels.length === 0) {
      window.alert("No channels found in selected group(s).");
      return;
    }

    const baseName = fileName
      ? fileName.replace(/\.(m3u8?|txt)$/i, "")
      : "playlist";

    const suffix =
      cleanGroups.length === 1
        ? makeSafeFileName(cleanGroups[0])
        : `${cleanGroups.length}-groups`;

    exportM3UWithName(
      exportChannels,
      `${makeSafeFileName(baseName)}-${suffix}.m3u`
    );

    closeFloatingMenus();
  }

  function applyBuiltInSwedishEpgIds() {
    if (channels.length === 0) {
      return;
    }

    if (selectedGroup === "All Channels") {
      const confirmed = window.confirm(
        "You are on All Channels. This will scan all channels and apply Swedish EPG IDs where it finds a match.\n\nContinue?"
      );

      if (!confirmed) {
        return;
      }
    }

    const targetGroup = selectedGroup;
    let checked = 0;
    let matched = 0;
    let changed = 0;
    let alreadyCorrect = 0;

    const updatedChannels = channels.map((channel) => {
      if (targetGroup !== "All Channels" && channel.group !== targetGroup) {
        return channel;
      }

      checked++;

      const match = findBuiltInSwedishEpgCode(channel);

      if (!match) {
        return channel;
      }

      matched++;

      if (channel.tvgId === match.code) {
        alreadyCorrect++;
        return channel;
      }

      const updatedChannel: Channel = {
        ...channel,
        tvgId: match.code,
        tvgName: channel.tvgName || match.name,
      };

      changed++;

      return {
        ...updatedChannel,
        rawInfo: updateChannelRawInfo(updatedChannel),
      };
    });

    if (changed === 0) {
      window.alert(
        `Swedish EPG IDs applied.\n\n` +
          `Target: ${targetGroup}\n` +
          `Checked: ${checked.toLocaleString()}\n` +
          `Matched: ${matched.toLocaleString()}\n` +
          `Changed: ${changed.toLocaleString()}\n` +
          `Already correct: ${alreadyCorrect.toLocaleString()}`
      );
      return;
    }

    pushUndoSnapshot();
    setChannels(updatedChannels);
    closeFloatingMenus();

    window.alert(
      `Swedish EPG IDs applied.\n\n` +
        `Target: ${targetGroup}\n` +
        `Checked: ${checked.toLocaleString()}\n` +
        `Matched: ${matched.toLocaleString()}\n` +
        `Changed: ${changed.toLocaleString()}\n` +
        `Already correct: ${alreadyCorrect.toLocaleString()}`
    );
  }

  function applySmartEpgMatches() {
    if (epgChannels.length === 0) {
      window.alert("Import an EPG file first.");
      return;
    }

    let applied = 0;
    const logoIdsToClear: string[] = [];

    const updatedChannels = channels.map((channel) => {
      const match = getEpgMatchForChannel(
        channel,
        epgChannels,
        epgIndexes,
        epgTargetGroup
      );

      if (
        (match.status !== "matched-name" && match.status !== "matched-id") ||
        !match.epgChannel
      ) {
        return channel;
      }

      const bestName = match.epgChannel.names[0] || channel.tvgName;
      const shouldUseEpgLogo =
        Boolean(match.epgChannel.logo) &&
        (!channel.tvgLogo || brokenLogoSet.has(channel.id));

      const updatedChannel: Channel = {
        ...channel,
        tvgId: match.epgChannel.id || channel.tvgId,
        tvgName: bestName || channel.tvgName,
        tvgLogo: shouldUseEpgLogo
          ? match.epgChannel.logo
          : channel.tvgLogo,
      };

      const changed =
        updatedChannel.tvgId !== channel.tvgId ||
        updatedChannel.tvgName !== channel.tvgName ||
        updatedChannel.tvgLogo !== channel.tvgLogo;

      if (!changed) {
        return channel;
      }

      if (shouldUseEpgLogo) {
        logoIdsToClear.push(channel.id);
      }

      applied++;

      return {
        ...updatedChannel,
        rawInfo: updateChannelRawInfo(updatedChannel),
      };
    });

    if (applied === 0) {
      window.alert("No EPG / logo matches to apply.");
      return;
    }

    pushUndoSnapshot();
    setChannels(updatedChannels);

    if (logoIdsToClear.length > 0) {
      setBrokenLogoIds((current) =>
        current.filter((id) => !logoIdsToClear.includes(id))
      );
    }

    closeFloatingMenus();
    window.alert(`Applied ${applied.toLocaleString()} EPG / logo match(es).`);
  }

  function openBulkRename() {
    if (selectedChannelIds.length === 0) {
      return;
    }

    closeFloatingMenus();
    setBulkRenameOpen(true);
  }

  function applyBulkRename() {
    if (selectedChannelIds.length === 0 || !bulkRenameHasChanges) {
      return;
    }

    const selectedSet = new Set(selectedChannelIds);
    let changed = 0;

    const updatedChannels = channels.map((channel) => {
      if (!selectedSet.has(channel.id)) {
        return channel;
      }

      const newName = bulkRenameName(channel.name, bulkRenameForm);

      if (newName === channel.name) {
        return channel;
      }

      changed++;

      const updatedChannel = {
        ...channel,
        name: newName,
      };

      return {
        ...updatedChannel,
        rawInfo: updateChannelRawInfo(updatedChannel),
      };
    });

    if (changed === 0) {
      setBulkRenameOpen(false);
      return;
    }

    pushUndoSnapshot();
    setChannels(updatedChannels);

    setBulkRenameOpen(false);
    setBulkRenameForm({
      prefix: "",
      suffix: "",
      find: "",
      replace: "",
      caseSensitive: false,
      mode: "contains",
    });
  }

  function moveGroupsToTop(groupNames: string[]) {
    if (groupNames.length === 0) {
      return;
    }

    pushUndoSnapshot();
    const nextOrder = moveSelectedGroupsToTop(groups, groupNames);
    setGroupOrder(nextOrder);
    setChannels((current) => reorderChannelsByGroupOrder(current, nextOrder));
    closeFloatingMenus();
  }

  function moveGroupsToBottom(groupNames: string[]) {
    if (groupNames.length === 0) {
      return;
    }

    pushUndoSnapshot();
    const nextOrder = moveSelectedGroupsToBottom(groups, groupNames);
    setGroupOrder(nextOrder);
    setChannels((current) => reorderChannelsByGroupOrder(current, nextOrder));
    closeFloatingMenus();
  }

  function moveChannelsToGroup(channelIds: string[], groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName || channelIds.length === 0) {
      return;
    }

    pushUndoSnapshot();

    setGroupOrder((current) => {
      if (current.includes(cleanGroupName)) {
        return current;
      }

      return [cleanGroupName, ...current];
    });

    setChannels((current) => {
      const ids = new Set(channelIds);

      const movedChannels = current
        .filter((channel) => ids.has(channel.id))
        .map((channel) => ({
          ...channel,
          group: cleanGroupName,
          rawInfo: updateGroupInRawInfo(channel.rawInfo, cleanGroupName),
        }));

      return insertChannelsAtBottomOfGroup(
        current,
        movedChannels,
        cleanGroupName,
        channelIds
      );
    });

    setSelectedGroup(cleanGroupName);
    setSelectedChannelIds([]);
    setLastSelectedChannelId("");
    setNewGroupName("");
    setGroupPickerMode(null);
    resetDragState();
  }

  function copyChannelsToGroup(channelIds: string[], groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName || channelIds.length === 0) {
      return;
    }

    pushUndoSnapshot();

    setGroupOrder((current) => {
      if (current.includes(cleanGroupName)) {
        return current;
      }

      return [cleanGroupName, ...current];
    });

    setChannels((current) => {
      const selectedChannels = current.filter((channel) =>
        channelIds.includes(channel.id)
      );

      const copiedChannels = selectedChannels
        .filter((channel) => {
          return !current.some(
            (existing) =>
              existing.group === cleanGroupName &&
              existing.url === channel.url &&
              existing.name === channel.name
          );
        })
        .map((channel) => ({
          ...channel,
          id: crypto.randomUUID(),
          group: cleanGroupName,
          rawInfo: updateGroupInRawInfo(channel.rawInfo, cleanGroupName),
        }));

      return insertChannelsAtBottomOfGroup(
        current,
        copiedChannels,
        cleanGroupName
      );
    });

    setSelectedGroup(cleanGroupName);
    setSelectedChannelIds([]);
    setLastSelectedChannelId("");
    setNewGroupName("");
    setGroupPickerMode(null);
    resetDragState();
  }

  function createNewGroupAndCopy() {
    copyChannelsToGroup(selectedChannelIds, newGroupName);
  }

  function createNewGroupAndMove() {
    moveChannelsToGroup(selectedChannelIds, newGroupName);
  }

  function moveSelectedToTop() {
    if (selectedChannelIds.length === 0) {
      return;
    }

    pushUndoSnapshot();

    const selectedSet = new Set(selectedChannelIds);

    setChannels((current) => {
      const selected = current.filter((channel) => selectedSet.has(channel.id));
      const rest = current.filter((channel) => !selectedSet.has(channel.id));

      if (selectedGroup === "All Channels") {
        return [...selected, ...rest];
      }

      const firstGroupIndex = rest.findIndex(
        (channel) => channel.group === selectedGroup
      );

      if (firstGroupIndex === -1) {
        return [...selected, ...rest];
      }

      return [
        ...rest.slice(0, firstGroupIndex),
        ...selected,
        ...rest.slice(firstGroupIndex),
      ];
    });

    closeFloatingMenus();
  }

  function moveSelectedToBottom() {
    if (selectedChannelIds.length === 0) {
      return;
    }

    pushUndoSnapshot();

    const selectedSet = new Set(selectedChannelIds);

    setChannels((current) => {
      const selected = current.filter((channel) => selectedSet.has(channel.id));
      const rest = current.filter((channel) => !selectedSet.has(channel.id));

      if (selectedGroup === "All Channels") {
        return [...rest, ...selected];
      }

      const lastGroupIndex = rest
        .map((channel) => channel.group)
        .lastIndexOf(selectedGroup);

      if (lastGroupIndex === -1) {
        return [...rest, ...selected];
      }

      return [
        ...rest.slice(0, lastGroupIndex + 1),
        ...selected,
        ...rest.slice(lastGroupIndex + 1),
      ];
    });

    closeFloatingMenus();
  }

  function openChannelEditor() {
    if (selectedChannelIds.length === 0) {
      return;
    }

    if (selectedChannelIds.length > 1) {
      openBulkRename();
      return;
    }

    const selectedChannel = channels.find(
      (channel) => channel.id === selectedChannelIds[0]
    );

    if (!selectedChannel) {
      return;
    }

    setChannelEditForm({
      id: selectedChannel.id,
      name: selectedChannel.name,
      url: selectedChannel.url,
      tvgId: selectedChannel.tvgId,
      tvgName: selectedChannel.tvgName,
      tvgLogo: selectedChannel.tvgLogo,
    });

    setChannelEditOpen(true);
    closeFloatingMenus();
  }

  function saveChannelEdit() {
    if (!channelEditForm) {
      return;
    }

    const cleanName = channelEditForm.name.trim() || "Unnamed channel";
    const cleanLogo = normalizeLogoUrl(channelEditForm.tvgLogo);

    const selectedChannel = channels.find(
      (channel) => channel.id === channelEditForm.id
    );

    if (!selectedChannel) {
      return;
    }

    const hasChanges =
      selectedChannel.name !== cleanName ||
      selectedChannel.url !== channelEditForm.url.trim() ||
      selectedChannel.tvgId !== channelEditForm.tvgId.trim() ||
      selectedChannel.tvgName !== channelEditForm.tvgName.trim() ||
      selectedChannel.tvgLogo !== cleanLogo;

    if (!hasChanges) {
      setChannelEditOpen(false);
      setChannelEditForm(null);
      return;
    }

    pushUndoSnapshot();

    setChannels((current) =>
      current.map((channel) => {
        if (channel.id !== channelEditForm.id) {
          return channel;
        }

        const updatedChannel: Channel = {
          ...channel,
          name: cleanName,
          url: channelEditForm.url.trim(),
          tvgId: channelEditForm.tvgId.trim(),
          tvgName: channelEditForm.tvgName.trim(),
          tvgLogo: cleanLogo,
        };

        return {
          ...updatedChannel,
          rawInfo: updateChannelRawInfo(updatedChannel),
        };
      })
    );

    setBrokenLogoIds((current) =>
      current.filter((id) => id !== channelEditForm.id)
    );

    setChannelEditOpen(false);
    setChannelEditForm(null);
  }

  function openLogoPreview() {
    if (selectedChannelIds.length !== 1) {
      window.alert("Select exactly one channel to preview its logo.");
      return;
    }

    setLogoPreviewOpen(true);
  }

  function openEpgModal() {
    if (selectedChannelIds.length !== 1) {
      window.alert("Select exactly one channel to view or edit EPG.");
      return;
    }

    const selectedChannel = channels.find(
      (channel) => channel.id === selectedChannelIds[0]
    );

    setEpgSearch(
      selectedChannel?.tvgName ||
        selectedChannel?.name ||
        selectedChannel?.tvgId ||
        ""
    );

    setEpgModalOpen(true);
  }

  function applyEpgChannelToSelected(epgChannel: EpgChannel) {
    if (!selectedEpgChannel) {
      return;
    }

    const bestName = epgChannel.names[0] || selectedEpgChannel.tvgName;

    pushUndoSnapshot();

    setChannels((current) =>
      current.map((channel) => {
        if (channel.id !== selectedEpgChannel.id) {
          return channel;
        }

        const shouldUseEpgLogo =
          Boolean(epgChannel.logo) &&
          (!channel.tvgLogo || brokenLogoSet.has(channel.id));

        const updatedChannel: Channel = {
          ...channel,
          tvgId: epgChannel.id || channel.tvgId,
          tvgName: bestName || channel.tvgName,
          tvgLogo: shouldUseEpgLogo
            ? epgChannel.logo
            : channel.tvgLogo,
        };

        return {
          ...updatedChannel,
          rawInfo: updateChannelRawInfo(updatedChannel),
        };
      })
    );

    if (epgChannel.logo) {
      setBrokenLogoIds((current) =>
        current.filter((id) => id !== selectedEpgChannel.id)
      );
    }

    setEpgModalOpen(false);
  }

  function startDraggingChannel(channelId: string) {
    if (selectedChannelSet.has(channelId)) {
      setDraggedChannelIds(selectedChannelIds);
      return selectedChannelIds;
    }

    setDraggedChannelIds([channelId]);
    return [channelId];
  }

  function startDraggingGroup(group: string) {
    const dragGroups = selectedGroupSet.has(group)
      ? selectedGroupNames
      : [group];

    setDraggedGroup(group);
    setDraggedGroupNames(dragGroups);

    return dragGroups;
  }

  function dropChannelsOnGroup(groupName: string) {
    if (draggedChannelIds.length === 0) {
      return;
    }

    copyChannelsToGroup(draggedChannelIds, groupName);
  }

  function dropChannelsOnChannel() {
    const target = currentDropTargetRef.current;

    if (!target || draggedChannelIds.length === 0) {
      resetDragState();
      return;
    }

    pushUndoSnapshot();

    setChannels((current) =>
      moveItemsNearTarget(
        current,
        draggedChannelIds,
        target.channelId,
        target.position
      )
    );

    resetDragState();
  }

  function handleGroupDrop(targetGroup: string) {
    if (
      draggedGroupNames.length > 0 &&
      !draggedGroupNames.includes(targetGroup) &&
      groupDropTarget
    ) {
      pushUndoSnapshot();

      const nextOrder = reorderMultipleGroups(
        groups,
        draggedGroupNames,
        targetGroup,
        groupDropTarget.position
      );

      setGroupOrder(nextOrder);
      setChannels((current) => reorderChannelsByGroupOrder(current, nextOrder));
      resetDragState();
      return;
    }

    if (draggedGroup && draggedGroup !== targetGroup && groupDropTarget) {
      pushUndoSnapshot();

      const nextOrder = reorderArrayItem(
        groups,
        draggedGroup,
        targetGroup,
        groupDropTarget.position
      );

      setGroupOrder(nextOrder);
      setChannels((current) => reorderChannelsByGroupOrder(current, nextOrder));
      resetDragState();
      return;
    }

    dropChannelsOnGroup(targetGroup);
  }

  function getDragText() {
    if (draggedChannelIds.length === 0) {
      return "";
    }

    if (draggedChannelIds.length === 1) {
      return "Copy 1 channel";
    }

    return `Copy ${draggedChannelIds.length.toLocaleString()} channels`;
  }

  function openRenameModal() {
    const target =
      groupActionTargets.length === 1 ? groupActionTargets[0] : selectedGroup;

    if (!target || target === "All Channels" || groupActionTargets.length > 1) {
      return;
    }

    setRenameGroupValue(target);
    setRenameGroupOpen(true);
    closeFloatingMenus();
  }

  function closeModals() {
    setGroupPickerMode(null);
    setGroupPickerSearch("");
    setRenameGroupOpen(false);
    setRenameGroupValue("");
    setChannelEditOpen(false);
    setChannelEditForm(null);
    setLogoPreviewOpen(false);
    setEpgModalOpen(false);
    setDeleteConfirm(null);
    setBulkRenameOpen(false);
    setEpgTargetModalOpen(false);
    setContextMenu(null);
  }

  function openChannelContextMenu(
    event: ReactMouseEvent<HTMLDivElement>,
    channel: Channel
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedChannelSet.has(channel.id)) {
      setSelectedChannelIds([channel.id]);
      setLastSelectedChannelId(channel.id);
    }

    setSelectedGroup(channel.group);
    setOpenMenu(null);
    setContextMenu({
      type: "channel",
      x: event.clientX,
      y: event.clientY,
    });
  }

  function openGroupContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    group: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedGroupSet.has(group)) {
      setSelectedGroupNames([group]);
      setLastSelectedGroupName(group);
    }

    setSelectedGroup(group);
    setOpenMenu(null);
    setContextMenu({
      type: "group",
      x: event.clientX,
      y: event.clientY,
    });
  }

  function renderChannelMenu(
    style?: React.CSSProperties,
    showEpgTools = true
  ) {
    return (
      <div
        className="popupMenu rightMenu m3uMenu"
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        {showEpgTools && (
          <>
            <button onClick={applyBuiltInSwedishEpgIds}>
              <span className="menuIcon">
                <CheckCircle2 size={23} strokeWidth={2.5} />
              </span>
              <span>Apply Swedish EPG IDs</span>
            </button>

            <button
              disabled={epgChannels.length === 0}
              onClick={applySmartEpgMatches}
            >
              <span className="menuIcon">
                <CheckCircle2 size={23} strokeWidth={2.5} />
              </span>
              <span>Apply XML EPG / Logo matches</span>
            </button>

            <hr />
          </>
        )}

        <button
          disabled={selectedChannelIds.length === 0}
          onClick={openChannelEditor}
        >
          <span className="menuIcon">
            <Type size={23} strokeWidth={2.5} />
          </span>
          <span>
            {selectedChannelIds.length > 1
              ? "Bulk Rename..."
              : "Rename / Edit..."}
          </span>
        </button>

        <button
          disabled={selectedChannelIds.length === 0}
          onClick={() => {
            setGroupPickerMode("move");
            closeFloatingMenus();
          }}
        >
          <span className="menuIcon">
            <FolderInput size={23} strokeWidth={2.5} />
          </span>
          <span>Move to group...</span>
        </button>

        <button
          disabled={selectedChannelIds.length === 0}
          onClick={() => {
            setGroupPickerMode("copy");
            closeFloatingMenus();
          }}
        >
          <span className="menuIcon">
            <CopyIcon size={23} strokeWidth={2.5} />
          </span>
          <span>Copy to group...</span>
        </button>

        <hr />

        <button
          disabled={selectedChannelIds.length === 0}
          onClick={moveSelectedToTop}
        >
          <span className="menuIcon">
            <ArrowUpToLine size={23} strokeWidth={2.5} />
          </span>
          <span>Move to top</span>
        </button>

        <button
          disabled={selectedChannelIds.length === 0}
          onClick={moveSelectedToBottom}
        >
          <span className="menuIcon">
            <ArrowDownToLine size={23} strokeWidth={2.5} />
          </span>
          <span>Move to bottom</span>
        </button>

        <hr />

        <button
          disabled={selectedChannelIds.length === 0}
          onClick={() => requestDelete(selectedChannelIds, [])}
        >
          <span className="menuIcon">
            <Trash2 size={23} strokeWidth={2.5} />
          </span>
          <span>Delete selected</span>
        </button>
      </div>
    );
  }

  function renderGroupMenu(style?: React.CSSProperties) {
    const canExportGroups = groupActionTargets.length > 0;

    return (
      <div
        className="popupMenu m3uMenu"
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={addGroupFromButton}>
          <span className="menuIcon">
            <Plus size={22} strokeWidth={2.5} />
          </span>
          <span>Add group</span>
        </button>

        <button
          disabled={
            groupActionTargets.length !== 1 ||
            groupActionTargets[0] === "All Channels"
          }
          onClick={openRenameModal}
        >
          <span className="menuIcon">
            <Type size={22} strokeWidth={2.5} />
          </span>
          <span>Rename group</span>
        </button>

        <button
          disabled={groupActionTargets.length === 0}
          onClick={() => requestDelete([], groupActionTargets)}
        >
          <span className="menuIcon">
            <Trash2 size={22} strokeWidth={2.5} />
          </span>
          <span>Delete group(s)</span>
        </button>

        <hr />

        <button
          disabled={!canExportGroups}
          onClick={() => exportGroups(groupActionTargets)}
        >
          <span className="menuIcon">⇩</span>
          <span>
            {groupActionTargets.length > 1
              ? "Export groups"
              : "Export group"}
          </span>
        </button>

        <hr />

        <button
          disabled={groupActionTargets.length === 0}
          onClick={() => moveGroupsToTop(groupActionTargets)}
        >
          <span className="menuIcon">
            <ArrowUpToLine size={22} strokeWidth={2.5} />
          </span>
          <span>Move group(s) to top</span>
        </button>

        <button
          disabled={groupActionTargets.length === 0}
          onClick={() => moveGroupsToBottom(groupActionTargets)}
        >
          <span className="menuIcon">
            <ArrowDownToLine size={22} strokeWidth={2.5} />
          </span>
          <span>Move group(s) to bottom</span>
        </button>
      </div>
    );
  }

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (deleteConfirm) {
        if (event.key === "Enter") {
          event.preventDefault();
          performDelete(deleteConfirm.channelIds, deleteConfirm.groupNames);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setDeleteConfirm(null);
          return;
        }
      }

      const anyModalOpen =
        groupPickerMode ||
        renameGroupOpen ||
        channelEditOpen ||
        logoPreviewOpen ||
        epgModalOpen ||
        epgTargetModalOpen ||
        deleteConfirm ||
        bulkRenameOpen;

      if (anyModalOpen) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastAction();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" ||
          (event.shiftKey && event.key.toLowerCase() === "z"))
      ) {
        event.preventDefault();
        redoLastAction();
        return;
      }

      if (event.key === "Escape") {
        closeFloatingMenus();
        return;
      }

      if (event.key === "Delete") {
        const hasSelectedChannels = selectedChannelIds.length > 0;
        const hasSelectedGroups = selectedGroupNames.length > 0;

        if (!hasSelectedChannels && !hasSelectedGroups) {
          return;
        }

        event.preventDefault();
        requestDelete(selectedChannelIds, selectedGroupNames);
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [
    bulkRenameOpen,
    channelEditOpen,
    deleteConfirm,
    epgModalOpen,
    epgTargetModalOpen,
    groupPickerMode,
    logoPreviewOpen,
    redoStack,
    renameGroupOpen,
    selectedChannelIds,
    selectedGroupNames,
    undoStack,
  ]);

  return (
    <main
      className="app"
      onClick={() => {
        closeFloatingMenus();
      }}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          setContextMenu(null);
        }
      }}
    >
      <header className="topBar">
        <div className="brand">
          <div className="logoMark">M</div>
          <div>
            <h1>Moses M3U Editor</h1>
            <p>Local browser playlist editor</p>
          </div>
        </div>

        <div className="topActions">
          <label
            className="importButton tooltipButton tooltipLeft"
            data-tooltip="Import M3U"
          >
            Import M3U
            <input
              type="file"
              accept=".m3u,.m3u8,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = "";
              }}
            />
          </label>

          <button
            className="primaryButton tooltipButton tooltipLeft"
            data-tooltip="Undo last action"
            disabled={!canUndo}
            onClick={undoLastAction}
          >
            Undo
          </button>

          <button
            className="primaryButton tooltipButton tooltipLeft"
            data-tooltip="Redo last undone action"
            disabled={!canRedo}
            onClick={redoLastAction}
          >
            Redo
          </button>

          <button
            className="primaryButton tooltipButton tooltipLeft"
            data-tooltip="Export M3U"
            disabled={channels.length === 0}
            onClick={() => exportM3U(channels, fileName)}
          >
            Export M3U
          </button>
        </div>
      </header>

      {channels.length === 0 && (
        <section className="emptyImport">
          <h2>Import your M3U file</h2>
          <p>Your playlist stays on your computer. Nothing is uploaded online.</p>

          <label className="bigImportButton">
            Choose M3U file
            <input
              type="file"
              accept=".m3u,.m3u8,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </section>
      )}

      {channels.length > 0 && (
        <>
          <section className="playlistStrip">
            <div>
              <strong>{fileName}</strong>
              <span>
                {channels.length.toLocaleString()} total channels
                {epgChannels.length > 0 &&
                  ` • XML EPG target: ${epgTargetGroup} • ${epgStats.matched.toLocaleString()} exact • ${epgStats.possible.toLocaleString()} possible`}
                {` • Logos: ${logoStats.withLogo.toLocaleString()} with URL • ${logoStats.missingLogo.toLocaleString()} missing`}
                {logoStats.brokenLogo > 0 &&
                  ` • ${logoStats.brokenLogo.toLocaleString()} broken`}
                {epgImportStatus && ` • ${epgImportStatus}`}
              </span>
            </div>

            <div className="stripTools">
              <input
                className="globalSearch"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search all channels..."
              />

              <select
                value={logoFilter}
                onChange={(event) => setLogoFilter(event.target.value as LogoFilter)}
                title="Logo filter"
                style={{
                  minWidth: 145,
                  height: 36,
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "0 10px",
                  background: "white",
                  color: "#111827",
                  fontWeight: 600,
                }}
              >
                <option value="all">All logos</option>
                <option value="has-logo">Has logo</option>
                <option value="missing-logo">Missing logo</option>
                <option value="broken-logo">Broken logo</option>
              </select>

              <button
                className="tooltipButton"
                data-tooltip="Select visible channels"
                onClick={toggleAllVisible}
              >
                {allVisibleSelected ? "Unselect visible" : "Select visible"}
              </button>

              <button
                className="tooltipButton tooltipLeft"
                data-tooltip="Clear all selection"
                onClick={clearSelection}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="editorLayout">
            <aside className="groupsPanel">
              <div className="panelHeader">
                <label>
                  <input
                    type="checkbox"
                    checked={allGroupsSelected}
                    onChange={toggleAllGroups}
                  />
                  <strong>Groups</strong>
                  <span>
                    {groups.length}
                    {selectedGroupNames.length > 0 &&
                      ` • ${selectedGroupNames.length} selected`}
                  </span>
                </label>

                <div className="miniButtons menuWrap">
                  {selectedGroupNames.length > 0 && (
                    <button
                      className="textActionButton tooltipButton"
                      data-tooltip="Clear selected groups"
                      onClick={() => setSelectedGroupNames([])}
                    >
                      Clear
                    </button>
                  )}

                  <button
                    className="iconButton tooltipButton"
                    data-tooltip="Add group"
                    title=""
                    onClick={addGroupFromButton}
                  >
                    <Plus size={22} strokeWidth={2.5} />
                  </button>

                  <button
                    className="iconButton tooltipButton tooltipLeft activeDotButton"
                    data-tooltip="Group options"
                    title=""
                    onClick={(event) => {
                      event.stopPropagation();
                      setContextMenu(null);
                      setOpenMenu(openMenu === "group" ? null : "group");
                    }}
                  >
                    <MoreVertical size={22} strokeWidth={2.5} />
                  </button>

                  {openMenu === "group" && renderGroupMenu()}
                </div>
              </div>

              <button
                className={
                  selectedGroup === "All Channels"
                    ? "groupRow allChannelsRow active"
                    : "groupRow allChannelsRow"
                }
                onClick={() => {
                  setSelectedGroup("All Channels");
                  setLastSelectedGroupName("");
                }}
              >
                <span></span>
                <span className="dragDots">⠿</span>
                <span>All Channels</span>
                <em>{channels.length.toLocaleString()}</em>
              </button>

              <div className="groupList">
                {groups.map((group) => {
                  const count = groupCounts.get(group) || 0;
                  const dropPosition =
                    groupDropTarget?.group === group
                      ? groupDropTarget.position
                      : null;

                  const className = [
                    "groupRow",
                    selectedGroup === group ? "active" : "",
                    selectedGroupSet.has(group) ? "groupSelected" : "",
                    dragOverGroup === group ? "dragOver" : "",
                    draggedGroupNames.includes(group) || draggedGroup === group
                      ? "groupDragging"
                      : "",
                    dropPosition === "above" ? "groupDropAbove" : "",
                    dropPosition === "below" ? "groupDropBelow" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={group}
                      className={className}
                      draggable
                      onDragStart={(event) => {
                        const dragGroups = startDraggingGroup(group);

                        const previewText =
                          dragGroups.length === 1
                            ? `Move group: ${group}`
                            : `Move ${dragGroups.length.toLocaleString()} groups`;

                        const preview = createDragPreview(previewText);
                        event.dataTransfer.setDragImage(preview, 12, 12);

                        window.setTimeout(() => {
                          preview.remove();
                        }, 0);

                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", group);
                      }}
                      onDragEnd={resetDragState}
                      onClick={(event) => {
                        if (event.shiftKey) {
                          selectGroupWithEvent(group, event);
                        } else {
                          setSelectedGroup(group);
                          setLastSelectedGroupName(group);
                        }
                      }}
                      onContextMenu={(event) => openGroupContextMenu(event, group)}
                      onDragOver={(event) => {
                        event.preventDefault();

                        if (
                          draggedGroupNames.length > 0 &&
                          !draggedGroupNames.includes(group)
                        ) {
                          setGroupDropTarget({
                            group,
                            position: getRowDropPosition(event),
                          });
                          return;
                        }

                        if (draggedGroup && draggedGroup !== group) {
                          setGroupDropTarget({
                            group,
                            position: getRowDropPosition(event),
                          });
                          return;
                        }

                        if (dragOverGroup !== group) {
                          setDragOverGroup(group);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverGroup("");
                        setGroupDropTarget(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleGroupDrop(group);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupSet.has(group)}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectGroupWithEvent(group, event);
                        }}
                        onChange={() => {}}
                      />

                      <span
                        className="dragDots dragHandle"
                        title=""
                        onClick={(event) => event.stopPropagation()}
                      >
                        ⠿
                      </span>

                      <span className="groupName">{group}</span>
                      <em>{count.toLocaleString()}</em>

                      {dragOverGroup === group &&
                        draggedChannelIds.length > 0 &&
                        !draggedGroup && <small>{getDragText()}</small>}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="channelsPanel">
              <div className="panelHeader channelHeader">
                <label>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                  <strong>{selectedGroup}</strong>
                  <span>
                    {filteredChannels.length.toLocaleString()} channels
                    {selectedChannelIds.length > 0 &&
                      ` • ${selectedChannelIds.length.toLocaleString()} selected`}
                  </span>
                </label>

                <div className="miniButtons menuWrap">
                  {selectedChannelIds.length > 0 && (
                    <button
                      className="textActionButton tooltipButton"
                      data-tooltip="Clear selected channels"
                      onClick={() => {
                        setSelectedChannelIds([]);
                        setLastSelectedChannelId("");
                      }}
                    >
                      Clear
                    </button>
                  )}

                  <label
                    className="textActionButton tooltipButton"
                    data-tooltip="Import EPG XML or XML.GZ"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      minHeight: 34,
                      cursor: "pointer",
                    }}
                  >
                    {epgImportStatus ? "Importing..." : "Import EPG"}
                    <input
                      type="file"
                      accept=".xml,.xmltv,.txt,.gz,.xml.gz"
                      style={{ display: "none" }}
                      disabled={Boolean(epgImportStatus)}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) chooseEpgFile(file);
                        event.target.value = "";
                      }}
                    />
                  </label>

                  <button
                    className="iconButton tooltipButton"
                    data-tooltip="EPG details"
                    disabled={selectedChannelIds.length !== 1}
                    onClick={openEpgModal}
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      width: 38,
                      minWidth: 38,
                      height: 34,
                      padding: 0,
                    }}
                  >
                    EPG
                  </button>

                  <button
                    className="iconButton tooltipButton"
                    data-tooltip="Logo preview"
                    disabled={selectedChannelIds.length !== 1}
                    onClick={openLogoPreview}
                  >
                    <ImageIcon size={21} strokeWidth={2.3} />
                  </button>

                  <button
                    className="iconButton tooltipButton"
                    data-tooltip="Add channel"
                    disabled
                  >
                    <Plus size={22} strokeWidth={2.5} />
                  </button>

                  <button
                    className="iconButton tooltipButton"
                    data-tooltip="Bulk rename"
                    disabled={selectedChannelIds.length === 0}
                    onClick={openBulkRename}
                  >
                    <ListFilter size={22} strokeWidth={2.5} />
                  </button>

                  <button
                    disabled={selectedChannelIds.length === 0}
                    className="textActionButton tooltipButton"
                    data-tooltip="Copy selected to group"
                    onClick={() => {
                      setGroupPickerMode("copy");
                      closeFloatingMenus();
                    }}
                  >
                    Copy +
                  </button>

                  <button
                    disabled={selectedChannelIds.length === 0}
                    className="textActionButton tooltipButton"
                    data-tooltip="Move selected to group"
                    onClick={() => {
                      setGroupPickerMode("move");
                      closeFloatingMenus();
                    }}
                  >
                    Move +
                  </button>

                  <button
                    className="iconButton tooltipButton tooltipLeft activeDotButton"
                    data-tooltip="More options"
                    title=""
                    onClick={(event) => {
                      event.stopPropagation();
                      setContextMenu(null);
                      setOpenMenu(openMenu === "channel" ? null : "channel");
                    }}
                  >
                    <MoreVertical size={22} strokeWidth={2.5} />
                  </button>

                  {openMenu === "channel" && renderChannelMenu()}
                </div>
              </div>

              <div className="actionBar">
                <select
                  value=""
                  disabled={selectedChannelIds.length === 0}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) copyChannelsToGroup(selectedChannelIds, value);
                  }}
                >
                  <option value="">Copy selected to group...</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>

                <select
                  value=""
                  disabled={selectedChannelIds.length === 0}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) moveChannelsToGroup(selectedChannelIds, value);
                  }}
                >
                  <option value="">Move selected to group...</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>

                <input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="New group name..."
                />

                <button
                  disabled={
                    selectedChannelIds.length === 0 || !newGroupName.trim()
                  }
                  onClick={createNewGroupAndCopy}
                >
                  Copy to new group
                </button>

                <button
                  disabled={
                    selectedChannelIds.length === 0 || !newGroupName.trim()
                  }
                  onClick={createNewGroupAndMove}
                >
                  Move to new group
                </button>
              </div>

              <div className="tableHeader">
                <span></span>
                <span></span>
                <span>Name</span>
                <span>Group</span>
                <span>URL</span>
              </div>

              <div
                ref={channelListRef}
                className="channelList"
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    hideDropIndicator();
                  }
                }}
              >
                <div ref={dropIndicatorRef} className="dropIndicator" />

                {visibleChannels.map((channel) => {
                  const isSelected = selectedChannelSet.has(channel.id);
                  const isDragging = draggedChannelIds.includes(channel.id);
                  const isBrokenLogo = brokenLogoSet.has(channel.id);
                  const epgMatch = epgMatchMap.get(channel.id) || {
                    status: "no-epg",
                    epgChannel: null,
                  };
                  const epgBadge = getEpgBadgeStyle(epgMatch);
                  const logoBadge = getLogoBadgeStyle(channel, isBrokenLogo);
                  const idBadge = getIdBadgeStyle(channel);

                  return (
                    <div
                      key={channel.id}
                      draggable
                      className={[
                        "channelRow",
                        isSelected ? "selected" : "",
                        isDragging ? "isDragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onDragStart={(event) => {
                        const ids = startDraggingChannel(channel.id);
                        const previewText =
                          ids.length === 1
                            ? channel.name
                            : `Moving ${ids.length.toLocaleString()} channels`;

                        const preview = createDragPreview(previewText);
                        event.dataTransfer.setDragImage(preview, 12, 12);

                        window.setTimeout(() => {
                          preview.remove();
                        }, 0);

                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", channel.id);
                      }}
                      onDragEnd={resetDragState}
                      onContextMenu={(event) => openChannelContextMenu(event, channel)}
                      onDoubleClick={() => {
                        setSelectedChannelIds([channel.id]);
                        setLastSelectedChannelId(channel.id);
                        setChannelEditForm({
                          id: channel.id,
                          name: channel.name,
                          url: channel.url,
                          tvgId: channel.tvgId,
                          tvgName: channel.tvgName,
                          tvgLogo: channel.tvgLogo,
                        });
                        setChannelEditOpen(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        showDropIndicator(event, channel.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropChannelsOnChannel();
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectChannelWithEvent(channel.id, event);
                        }}
                        onChange={() => {}}
                      />

                      <span
                        className="dragDots dragHandle"
                        title=""
                        onClick={(event) => event.stopPropagation()}
                      >
                        ⠿
                      </span>

                      <div className="channelNameCell">
                        <ChannelLogo
                          logo={channel.tvgLogo}
                          name={channel.name}
                          size={26}
                          onStatusChange={(status) =>
                            markLogoStatus(channel.id, status)
                          }
                        />
                        <span>{channel.name}</span>

                        <span
                          title={logoBadge.title}
                          style={{
                            background: logoBadge.background,
                            color: logoBadge.color,
                            borderRadius: 999,
                            padding: "2px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                            fontStyle: "normal",
                            whiteSpace: "nowrap",
                            flex: "0 0 auto",
                          }}
                        >
                          {logoBadge.text}
                        </span>

                        <span
                          title={idBadge.title}
                          style={{
                            background: idBadge.background,
                            color: idBadge.color,
                            borderRadius: 999,
                            padding: "2px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                            fontStyle: "normal",
                            whiteSpace: "nowrap",
                            flex: "0 0 auto",
                          }}
                        >
                          {idBadge.text}
                        </span>

                        {epgChannels.length > 0 &&
                          epgMatch.status !== "not-target-group" && (
                            <span
                              title={epgBadge.title}
                              style={{
                                background: epgBadge.background,
                                color: epgBadge.color,
                                borderRadius: 999,
                                padding: "2px 7px",
                                fontSize: 10,
                                fontWeight: 800,
                                fontStyle: "normal",
                                whiteSpace: "nowrap",
                                flex: "0 0 auto",
                              }}
                            >
                              {epgBadge.text}
                            </span>
                          )}
                      </div>

                      <span className="groupCell">{channel.group}</span>
                      <span className="urlCell">{channel.url}</span>
                    </div>
                  );
                })}

                {filteredChannels.length > 1000 && (
                  <div className="limitNotice">
                    Showing first 1000 results. Use search or a group filter to
                    narrow the list.
                  </div>
                )}

                {filteredChannels.length === 0 && (
                  <div className="emptyState">No channels found.</div>
                )}
              </div>
            </section>
          </section>

          {contextMenu?.type === "channel" &&
            renderChannelMenu(
              {
                position: "fixed",
                left: Math.min(contextMenu.x, window.innerWidth - 330),
                top: Math.min(contextMenu.y, window.innerHeight - 520),
                zIndex: 9999,
              },
              false
            )}

          {contextMenu?.type === "group" &&
            renderGroupMenu({
              position: "fixed",
              left: Math.min(contextMenu.x, window.innerWidth - 330),
              top: Math.min(contextMenu.y, window.innerHeight - 430),
              zIndex: 9999,
            })}

          {epgTargetModalOpen && pendingEpgFile && (
            <div className="modalBackdrop" onClick={cancelPendingEpgImport}>
              <div
                className="smallModal"
                onClick={(event) => event.stopPropagation()}
                style={{ width: 520 }}
              >
                <h2>Import EPG</h2>

                <p style={{ color: "#6b7280", marginTop: 6 }}>
                  Choose which group this EPG should match against.
                </p>

                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    background: "#f9fafb",
                    marginTop: 14,
                    marginBottom: 14,
                  }}
                >
                  <strong>File</strong>
                  <div
                    style={{
                      color: "#374151",
                      marginTop: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pendingEpgFile.name}
                  </div>
                </div>

                <label style={{ display: "grid", gap: 8 }}>
                  Group to match
                  <select
                    autoFocus
                    value={pendingEpgTargetGroup}
                    onChange={(event) =>
                      setPendingEpgTargetGroup(event.target.value)
                    }
                    style={{
                      height: 44,
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      padding: "0 12px",
                      fontSize: 16,
                    }}
                  >
                    <option value="All Channels">All Channels</option>
                    {groups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>

                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 13,
                    marginTop: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Choosing a specific group makes matching cleaner and avoids
                  checking unrelated channels.
                </div>

                <div className="modalFooter">
                  <button onClick={cancelPendingEpgImport}>Cancel</button>
                  <button
                    className="confirmButton"
                    onClick={importPendingEpgFile}
                  >
                    Import EPG
                  </button>
                </div>
              </div>
            </div>
          )}

          {epgModalOpen && selectedEpgChannel && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="channelEditModal"
                onClick={(event) => event.stopPropagation()}
                style={{ width: 720 }}
              >
                <div className="modalTitle">
                  <span>EPG</span>
                  <h2>EPG Details</h2>
                  <em>
                    {epgChannels.length > 0
                      ? `${epgChannels.length.toLocaleString()} XML EPG channels`
                      : "No XML imported"}
                  </em>
                </div>

                <div className="editForm">
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
                      background: "#f9fafb",
                    }}
                  >
                    <strong>{selectedEpgChannel.name}</strong>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 1fr",
                        gap: 8,
                        marginTop: 12,
                        color: "#374151",
                      }}
                    >
                      <span>EPG ID status</span>
                      <code>
                        {selectedEpgChannel.tvgId
                          ? `ID OK: ${selectedEpgChannel.tvgId}`
                          : "NO ID"}
                      </code>

                      <span>Channel name</span>
                      <code>{selectedEpgChannel.name || "Empty"}</code>

                      <span>Cleaned name</span>
                      <code>{cleanNameForEpg(selectedEpgChannel.name) || "Empty"}</code>

                      <span>tvg-id</span>
                      <code>{selectedEpgChannel.tvgId || "Empty"}</code>

                      <span>tvg-name</span>
                      <code>{selectedEpgChannel.tvgName || "Empty"}</code>

                      <span>tvg-logo</span>
                      <code
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {selectedEpgChannel.tvgLogo || "Empty"}
                      </code>

                      <span>Group</span>
                      <code>{selectedEpgChannel.group}</code>
                    </div>
                  </div>

                  {epgChannels.length === 0 && (
                    <div
                      style={{
                        border: "1px solid #dbeafe",
                        borderRadius: 12,
                        padding: 16,
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Current EPG ID is shown above.</strong>
                      <div style={{ marginTop: 6 }}>
                        Swedish EPG IDs do not require an XML file. They write the
                        ID directly into <code>tvg-id</code>, for example{" "}
                        <code>SVT1.se</code> or <code>TV4.se</code>.
                      </div>
                      <div style={{ marginTop: 6 }}>
                        Import an XML/XML.GZ file only if you want to search and
                        map against a full XMLTV channel list or apply XML logo
                        links.
                      </div>
                    </div>
                  )}

                  {epgChannels.length > 0 && (
                    <>
                      <label>
                        Search XML EPG channels
                        <input
                          autoFocus
                          value={epgSearch}
                          onChange={(event) => setEpgSearch(event.target.value)}
                          placeholder="Search by EPG id or display name..."
                        />
                      </label>

                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          overflow: "hidden",
                          maxHeight: 340,
                          overflowY: "auto",
                        }}
                      >
                        {epgSearchResults.map((epgChannel) => (
                          <button
                            key={`${epgChannel.id}-${epgChannel.names.join("|")}-${epgChannel.logo}`}
                            onClick={() => applyEpgChannelToSelected(epgChannel)}
                            style={{
                              width: "100%",
                              border: 0,
                              borderBottom: "1px solid #e5e7eb",
                              background: "white",
                              textAlign: "left",
                              padding: "12px 14px",
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <strong>
                                {epgChannel.names[0] || epgChannel.id || "Unnamed EPG"}
                              </strong>
                              <div
                                style={{
                                  color: "#6b7280",
                                  fontSize: 12,
                                  marginTop: 4,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {epgChannel.names.slice(1).join(" • ") ||
                                  "No extra names"}
                              </div>
                              <div
                                style={{
                                  color: epgChannel.logo ? "#166534" : "#9ca3af",
                                  fontSize: 11,
                                  marginTop: 3,
                                }}
                              >
                                {epgChannel.logo ? "Logo found" : "No logo"}
                              </div>
                            </div>

                            <code
                              style={{
                                color: "#4338ca",
                                background: "#eef2ff",
                                borderRadius: 999,
                                padding: "4px 8px",
                                fontSize: 12,
                              }}
                            >
                              {epgChannel.id || "No ID"}
                            </code>
                          </button>
                        ))}

                        {epgSearchResults.length === 0 && (
                          <div
                            style={{
                              padding: 18,
                              color: "#6b7280",
                              textAlign: "center",
                            }}
                          >
                            No XML EPG channels found.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="modalFooter">
                  <button onClick={closeModals}>Close</button>
                </div>
              </div>
            </div>
          )}

          {bulkRenameOpen && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="channelEditModal"
                onClick={(event) => event.stopPropagation()}
                style={{ width: 640 }}
              >
                <div className="modalTitle">
                  <span>
                    <Type size={26} />
                  </span>
                  <h2>Bulk Rename</h2>
                  <em>{selectedChannelIds.length.toLocaleString()} selected</em>
                </div>

                <div className="editForm">
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
                      background: "#f9fafb",
                    }}
                  >
                    <strong>Prefix & Suffix</strong>
                    <div
                      style={{
                        color: "#6b7280",
                        marginTop: 4,
                        marginBottom: 12,
                      }}
                    >
                      Add fixed text to the beginning or end of every name.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <label>
                        Prefix
                        <input
                          value={bulkRenameForm.prefix}
                          onChange={(event) =>
                            setBulkRenameForm({
                              ...bulkRenameForm,
                              prefix: event.target.value,
                            })
                          }
                          placeholder="Prefix"
                        />
                      </label>

                      <label>
                        Suffix
                        <input
                          value={bulkRenameForm.suffix}
                          onChange={(event) =>
                            setBulkRenameForm({
                              ...bulkRenameForm,
                              suffix: event.target.value,
                            })
                          }
                          placeholder="Suffix"
                        />
                      </label>
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
                      background: "#f9fafb",
                    }}
                  >
                    <strong>Find & Replace</strong>
                    <div
                      style={{
                        color: "#6b7280",
                        marginTop: 4,
                        marginBottom: 12,
                      }}
                    >
                      Search text in the channel name and replace it.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <label>
                        Find
                        <input
                          value={bulkRenameForm.find}
                          onChange={(event) =>
                            setBulkRenameForm({
                              ...bulkRenameForm,
                              find: event.target.value,
                            })
                          }
                          placeholder="Find"
                        />
                      </label>

                      <label>
                        Replace with
                        <input
                          value={bulkRenameForm.replace}
                          onChange={(event) =>
                            setBulkRenameForm({
                              ...bulkRenameForm,
                              replace: event.target.value,
                            })
                          }
                          placeholder="Replace with"
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <input
                        id="case-sensitive-checkbox"
                        type="checkbox"
                        checked={bulkRenameForm.caseSensitive}
                        onChange={(event) =>
                          setBulkRenameForm({
                            ...bulkRenameForm,
                            caseSensitive: event.target.checked,
                          })
                        }
                        style={{
                          width: 18,
                          height: 18,
                          margin: 0,
                        }}
                      />

                      <label
                        htmlFor="case-sensitive-checkbox"
                        style={{
                          display: "inline",
                          margin: 0,
                          fontWeight: 500,
                          color: "#374151",
                          cursor: "pointer",
                        }}
                      >
                        Case-sensitive
                      </label>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <strong>Match mode</strong>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          border: "1px solid #d1d5db",
                          borderRadius: 10,
                          overflow: "hidden",
                          marginTop: 8,
                        }}
                      >
                        {(["contains", "begins", "ends"] as BulkRenameMode[]).map(
                          (mode) => (
                            <button
                              key={mode}
                              style={{
                                border: 0,
                                padding: "10px 12px",
                                background:
                                  bulkRenameForm.mode === mode
                                    ? "#dbeafe"
                                    : "white",
                                color: "#111827",
                                fontWeight:
                                  bulkRenameForm.mode === mode ? 700 : 500,
                              }}
                              onClick={() =>
                                setBulkRenameForm({
                                  ...bulkRenameForm,
                                  mode,
                                })
                              }
                            >
                              {mode === "contains"
                                ? "Contains"
                                : mode === "begins"
                                  ? "Begins with"
                                  : "Ends with"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modalFooter">
                  <button onClick={closeModals}>Cancel</button>
                  <button
                    className="confirmButton"
                    disabled={!bulkRenameHasChanges}
                    onClick={applyBulkRename}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {groupPickerMode && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="groupPickerModal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modalTitle">
                  <span>
                    {groupPickerMode === "copy" ? (
                      <CopyIcon size={26} />
                    ) : (
                      <FolderInput size={26} />
                    )}
                  </span>
                  <h2>
                    {groupPickerMode === "copy"
                      ? "Copy to Group"
                      : "Move to Group"}
                  </h2>
                  <em>{selectedChannelIds.length} channels</em>
                </div>

                <div className="modalSearch">
                  <span>⌕</span>
                  <input
                    autoFocus
                    value={groupPickerSearch}
                    onChange={(event) => setGroupPickerSearch(event.target.value)}
                    placeholder="Search groups..."
                  />
                </div>

                <div className="modalGroupList">
                  {groupPickerGroups.map((group) => (
                    <button
                      key={group}
                      onClick={() => {
                        if (groupPickerMode === "copy") {
                          copyChannelsToGroup(selectedChannelIds, group);
                        } else {
                          moveChannelsToGroup(selectedChannelIds, group);
                        }
                      }}
                    >
                      <span className="radioCircle"></span>
                      <span className="folderIcon">■</span>
                      <span>{group}</span>
                      <em>{groupCounts.get(group) || 0}</em>
                    </button>
                  ))}
                </div>

                <div className="modalFooter">
                  <button onClick={closeModals}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {renameGroupOpen && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="smallModal"
                onClick={(event) => event.stopPropagation()}
              >
                <h2>Rename group</h2>
                <input
                  autoFocus
                  value={renameGroupValue}
                  onChange={(event) => setRenameGroupValue(event.target.value)}
                />

                <div className="modalFooter">
                  <button onClick={closeModals}>Cancel</button>
                  <button
                    className="confirmButton"
                    onClick={() =>
                      renameGroup(groupActionTargets[0], renameGroupValue)
                    }
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}

          {channelEditOpen && channelEditForm && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="channelEditModal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modalTitle">
                  <span>
                    <Type size={26} />
                  </span>
                  <h2>Rename / Edit Channel</h2>
                </div>

                <div className="editForm">
                  <label>
                    Channel name
                    <input
                      autoFocus
                      value={channelEditForm.name}
                      onChange={(event) =>
                        setChannelEditForm({
                          ...channelEditForm,
                          name: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Stream URL
                    <input
                      value={channelEditForm.url}
                      onChange={(event) =>
                        setChannelEditForm({
                          ...channelEditForm,
                          url: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    tvg-id
                    <input
                      value={channelEditForm.tvgId}
                      onChange={(event) =>
                        setChannelEditForm({
                          ...channelEditForm,
                          tvgId: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    tvg-name
                    <input
                      value={channelEditForm.tvgName}
                      onChange={(event) =>
                        setChannelEditForm({
                          ...channelEditForm,
                          tvgName: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    tvg-logo
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={channelEditForm.tvgLogo}
                        onChange={(event) =>
                          setChannelEditForm({
                            ...channelEditForm,
                            tvgLogo: event.target.value,
                          })
                        }
                        style={{ flex: 1 }}
                      />

                      <button
                        type="button"
                        title="Clear logo"
                        onClick={() =>
                          setChannelEditForm({
                            ...channelEditForm,
                            tvgLogo: "",
                          })
                        }
                        style={{
                          border: "1px solid #d1d5db",
                          background: "white",
                          borderRadius: 10,
                          padding: "0 12px",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </label>

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: "#f9fafb",
                    }}
                  >
                    <ChannelLogo
                      logo={channelEditForm.tvgLogo}
                      name={channelEditForm.name}
                      size={72}
                    />
                    <div style={{ minWidth: 0 }}>
                      <strong>Logo preview</strong>
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: 12,
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 460,
                        }}
                      >
                        {channelEditForm.tvgLogo || "No logo URL"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modalFooter">
                  <button onClick={closeModals}>Cancel</button>
                  <button className="confirmButton" onClick={saveChannelEdit}>
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {logoPreviewOpen && selectedLogoChannel && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="smallModal"
                onClick={(event) => event.stopPropagation()}
                style={{ width: 560 }}
              >
                <h2>Logo Preview</h2>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 0",
                  }}
                >
                  <ChannelLogo
                    logo={selectedLogoChannel.tvgLogo}
                    name={selectedLogoChannel.name}
                    size={112}
                    onStatusChange={(status) =>
                      markLogoStatus(selectedLogoChannel.id, status)
                    }
                  />

                  <div style={{ minWidth: 0 }}>
                    <strong>{selectedLogoChannel.name}</strong>
                    <div style={{ color: "#6b7280", marginTop: 4 }}>
                      {selectedLogoChannel.group}
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: 12,
                        marginTop: 8,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 390,
                      }}
                    >
                      {selectedLogoChannel.tvgLogo || "No logo URL found"}
                    </div>
                  </div>
                </div>

                <div className="modalFooter">
                  <button onClick={closeModals}>Close</button>
                  <button
                    className="confirmButton"
                    onClick={() => {
                      setChannelEditForm({
                        id: selectedLogoChannel.id,
                        name: selectedLogoChannel.name,
                        url: selectedLogoChannel.url,
                        tvgId: selectedLogoChannel.tvgId,
                        tvgName: selectedLogoChannel.tvgName,
                        tvgLogo: selectedLogoChannel.tvgLogo,
                      });
                      setLogoPreviewOpen(false);
                      setChannelEditOpen(true);
                    }}
                  >
                    Edit logo
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteConfirm && (
            <div className="modalBackdrop" onClick={closeModals}>
              <div
                className="smallModal"
                onClick={(event) => event.stopPropagation()}
                style={{ width: 500 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                      background: "#fee2e2",
                      color: "#dc2626",
                    }}
                  >
                    <Trash2 size={24} strokeWidth={2.5} />
                  </div>

                  <div>
                    <h2 style={{ margin: 0 }}>Delete selected?</h2>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Press Enter to delete, or Esc to cancel.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    background: "#f9fafb",
                    lineHeight: 1.7,
                  }}
                >
                  {deleteConfirm.channelIds.length > 0 && (
                    <div>
                      <strong>
                        {deleteConfirm.channelIds.length.toLocaleString()}
                      </strong>{" "}
                      channel(s) will be permanently deleted.
                    </div>
                  )}

                  {deleteConfirm.groupNames.length > 0 && (
                    <div>
                      <strong>
                        {deleteConfirm.groupNames.length.toLocaleString()}
                      </strong>{" "}
                      group(s) and{" "}
                      <strong>{deleteGroupChannelCount.toLocaleString()}</strong>{" "}
                      channel(s) inside them will be permanently deleted.
                    </div>
                  )}
                </div>

                <div className="modalFooter">
                  <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
                  <button
                    onClick={() =>
                      performDelete(
                        deleteConfirm.channelIds,
                        deleteConfirm.groupNames
                      )
                    }
                    style={{
                      border: 0,
                      background: "#dc2626",
                      color: "white",
                      borderRadius: 10,
                      padding: "10px 16px",
                      fontWeight: 700,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
