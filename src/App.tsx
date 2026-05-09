import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy as CopyIcon,
  Eye,
  FolderInput,
  Image as ImageIcon,
  ListFilter,
  MoreVertical,
  Plus,
  Trash2,
  Type,
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

function ChannelLogo({
  logo,
  name,
  size = 22,
}: {
  logo: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const wrapperStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: 4,
    background: "#e5e7eb",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
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
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
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
        tvgLogo: getAttribute(line, "tvg-logo"),
      });
    }
  }

  return channels;
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

function insertChannelsAtTopOfGroup(
  current: Channel[],
  itemsToInsert: Channel[],
  targetGroup: string,
  removeIds: string[] = []
): Channel[] {
  const removeSet = new Set(removeIds);
  const remaining = current.filter((channel) => !removeSet.has(channel.id));

  const firstTargetGroupIndex = remaining.findIndex(
    (channel) => channel.group === targetGroup
  );

  if (firstTargetGroupIndex === -1) {
    return [...itemsToInsert, ...remaining];
  }

  return [
    ...remaining.slice(0, firstTargetGroupIndex),
    ...itemsToInsert,
    ...remaining.slice(firstTargetGroupIndex),
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

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Channels");
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedChannelIds, setDraggedChannelIds] = useState<string[]>([]);
  const [dragOverGroup, setDragOverGroup] = useState("");
  const [draggedGroup, setDraggedGroup] = useState("");
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

  const channelListRef = useRef<HTMLDivElement | null>(null);
  const dropIndicatorRef = useRef<HTMLDivElement | null>(null);
  const currentDropTargetRef = useRef<DropTarget | null>(null);

  const selectedChannelSet = useMemo(() => {
    return new Set(selectedChannelIds);
  }, [selectedChannelIds]);

  const selectedGroupSet = useMemo(() => {
    return new Set(selectedGroupNames);
  }, [selectedGroupNames]);

  const selectedLogoChannel = useMemo(() => {
    if (selectedChannelIds.length !== 1) {
      return null;
    }

    return channels.find((channel) => channel.id === selectedChannelIds[0]) || null;
  }, [channels, selectedChannelIds]);

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

      if (!search) {
        return true;
      }

      return (
        channel.name.toLowerCase().includes(search) ||
        channel.group.toLowerCase().includes(search) ||
        channel.url.toLowerCase().includes(search) ||
        channel.tvgId.toLowerCase().includes(search) ||
        channel.tvgName.toLowerCase().includes(search)
      );
    });
  }, [channels, selectedGroup, searchText]);

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
      setSelectedGroupNames([]);
      setSelectedChannelIds([]);
      setSearchText("");
      setNewGroupName("");
      setLogoPreviewOpen(false);
      setDeleteConfirm(null);
      setBulkRenameOpen(false);
      resetDragState();
    };

    reader.readAsText(file);
  }

  function toggleChannel(channelId: string) {
    setSelectedChannelIds((current) => {
      if (current.includes(channelId)) {
        return current.filter((id) => id !== channelId);
      }

      return [...current, channelId];
    });
  }

  function toggleGroupSelection(groupName: string) {
    setSelectedGroupNames((current) => {
      if (current.includes(groupName)) {
        return current.filter((group) => group !== groupName);
      }

      return [...current, groupName];
    });
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

    setGroupOrder((current) => [cleanGroupName, ...current]);
    setSelectedGroup(cleanGroupName);
    setSelectedGroupNames([cleanGroupName]);
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

    setSelectedGroup(cleanNewName);
    setSelectedGroupNames([cleanNewName]);
    setRenameGroupOpen(false);
    setRenameGroupValue("");
  }

  function performDelete(channelIds: string[], groupNames: string[]) {
    const channelIdSet = new Set(channelIds);
    const groupNameSet = new Set(groupNames);

    setChannels((current) =>
      current.filter(
        (channel) =>
          !channelIdSet.has(channel.id) && !groupNameSet.has(channel.group)
      )
    );

    if (groupNames.length > 0) {
      setGroupOrder((current) =>
        current.filter((group) => !groupNameSet.has(group))
      );

      if (groupNameSet.has(selectedGroup)) {
        setSelectedGroup("All Channels");
      }
    }

    setSelectedChannelIds([]);
    setSelectedGroupNames([]);
    setOpenMenu(null);
    setDeleteConfirm(null);
  }

  function requestDelete(channelIds: string[], groupNames: string[]) {
    if (channelIds.length === 0 && groupNames.length === 0) {
      return;
    }

    setOpenMenu(null);
    setDeleteConfirm({
      channelIds,
      groupNames,
    });
  }

  function openBulkRename() {
    if (selectedChannelIds.length === 0) {
      return;
    }

    setOpenMenu(null);
    setBulkRenameOpen(true);
  }

  function applyBulkRename() {
    if (selectedChannelIds.length === 0 || !bulkRenameHasChanges) {
      return;
    }

    const selectedSet = new Set(selectedChannelIds);

    setChannels((current) =>
      current.map((channel) => {
        if (!selectedSet.has(channel.id)) {
          return channel;
        }

        const newName = bulkRenameName(channel.name, bulkRenameForm);

        const updatedChannel = {
          ...channel,
          name: newName,
        };

        return {
          ...updatedChannel,
          rawInfo: updateChannelRawInfo(updatedChannel),
        };
      })
    );

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

    const nextOrder = moveSelectedGroupsToTop(groups, groupNames);
    setGroupOrder(nextOrder);
    setChannels((current) => reorderChannelsByGroupOrder(current, nextOrder));
    setOpenMenu(null);
  }

  function moveGroupsToBottom(groupNames: string[]) {
    if (groupNames.length === 0) {
      return;
    }

    const nextOrder = moveSelectedGroupsToBottom(groups, groupNames);
    setGroupOrder(nextOrder);
    setChannels((current) => reorderChannelsByGroupOrder(current, nextOrder));
    setOpenMenu(null);
  }

  function moveChannelsToGroup(channelIds: string[], groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName || channelIds.length === 0) {
      return;
    }

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

      return insertChannelsAtTopOfGroup(
        current,
        movedChannels,
        cleanGroupName,
        channelIds
      );
    });

    setSelectedGroup(cleanGroupName);
    setSelectedChannelIds([]);
    setNewGroupName("");
    setGroupPickerMode(null);
    resetDragState();
  }

  function copyChannelsToGroup(channelIds: string[], groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName || channelIds.length === 0) {
      return;
    }

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

      return insertChannelsAtTopOfGroup(current, copiedChannels, cleanGroupName);
    });

    setSelectedGroup(cleanGroupName);
    setSelectedChannelIds([]);
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

    setOpenMenu(null);
  }

  function moveSelectedToBottom() {
    if (selectedChannelIds.length === 0) {
      return;
    }

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

    setOpenMenu(null);
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
    setOpenMenu(null);
  }

  function saveChannelEdit() {
    if (!channelEditForm) {
      return;
    }

    const cleanName = channelEditForm.name.trim() || "Unnamed channel";

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
          tvgLogo: channelEditForm.tvgLogo.trim(),
        };

        return {
          ...updatedChannel,
          rawInfo: updateChannelRawInfo(updatedChannel),
        };
      })
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

  function startDraggingChannel(channelId: string) {
    if (selectedChannelSet.has(channelId)) {
      setDraggedChannelIds(selectedChannelIds);
      return selectedChannelIds;
    }

    setDraggedChannelIds([channelId]);
    return [channelId];
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
    if (draggedGroup && draggedGroup !== targetGroup && groupDropTarget) {
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
    setOpenMenu(null);
  }

  function closeModals() {
    setGroupPickerMode(null);
    setGroupPickerSearch("");
    setRenameGroupOpen(false);
    setRenameGroupValue("");
    setChannelEditOpen(false);
    setChannelEditForm(null);
    setLogoPreviewOpen(false);
    setDeleteConfirm(null);
    setBulkRenameOpen(false);
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
        deleteConfirm ||
        bulkRenameOpen;

      if (anyModalOpen) {
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
    groupPickerMode,
    logoPreviewOpen,
    renameGroupOpen,
    selectedChannelIds,
    selectedGroupNames,
  ]);

  return (
    <main className="app" onClick={() => setOpenMenu(null)}>
      <header className="topBar">
        <div className="brand">
          <div className="logoMark">M</div>
          <div>
            <h1>Moses M3U Editor</h1>
            <p>Local browser playlist editor</p>
          </div>
        </div>

        <div className="topActions">
          <label className="importButton tooltipButton tooltipLeft" data-tooltip="Import M3U">
            Import M3U
            <input
              type="file"
              accept=".m3u,.m3u8,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

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
              <span>{channels.length.toLocaleString()} total channels</span>
            </div>

            <div className="stripTools">
              <input
                className="globalSearch"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search all channels..."
              />

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
                      setOpenMenu(openMenu === "group" ? null : "group");
                    }}
                  >
                    <MoreVertical size={22} strokeWidth={2.5} />
                  </button>

                  {openMenu === "group" && (
                    <div
                      className="popupMenu m3uMenu"
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
                  )}
                </div>
              </div>

              <button
                className={
                  selectedGroup === "All Channels"
                    ? "groupRow allChannelsRow active"
                    : "groupRow allChannelsRow"
                }
                onClick={() => setSelectedGroup("All Channels")}
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
                    draggedGroup === group ? "groupDragging" : "",
                    dropPosition === "above" ? "groupDropAbove" : "",
                    dropPosition === "below" ? "groupDropBelow" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={group}
                      className={className}
                      onClick={() => setSelectedGroup(group)}
                      onDragOver={(event) => {
                        event.preventDefault();

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
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleGroupSelection(group)}
                      />

                      <span
                        className="dragDots dragHandle"
                        draggable
                        title=""
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDraggedGroup(group);

                          const preview = createDragPreview(`Move group: ${group}`);
                          event.dataTransfer.setDragImage(preview, 12, 12);

                          window.setTimeout(() => {
                            preview.remove();
                          }, 0);

                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", group);
                        }}
                        onDragEnd={resetDragState}
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
                      onClick={() => setSelectedChannelIds([])}
                    >
                      Clear
                    </button>
                  )}

                  <button
                    className="iconButton tooltipButton"
                    data-tooltip="EPG"
                    disabled
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
                      setOpenMenu(null);
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
                      setOpenMenu(null);
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
                      setOpenMenu(openMenu === "channel" ? null : "channel");
                    }}
                  >
                    <MoreVertical size={22} strokeWidth={2.5} />
                  </button>

                  {openMenu === "channel" && (
                    <div
                      className="popupMenu rightMenu m3uMenu"
                      onClick={(event) => event.stopPropagation()}
                    >
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

                      <button disabled={selectedChannelIds.length === 0}>
                        <span className="menuIcon">
                          <Eye size={23} strokeWidth={2.5} />
                        </span>
                        <span>Show / Hide...</span>
                      </button>

                      <button
                        disabled={selectedChannelIds.length === 0}
                        onClick={() => {
                          setGroupPickerMode("move");
                          setOpenMenu(null);
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
                          setOpenMenu(null);
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
                  )}
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

                  return (
                    <div
                      key={channel.id}
                      className={[
                        "channelRow",
                        isSelected ? "selected" : "",
                        isDragging ? "isDragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggleChannel(channel.id)}
                      onDoubleClick={() => {
                        setSelectedChannelIds([channel.id]);
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
                        onChange={() => toggleChannel(channel.id)}
                        onClick={(event) => event.stopPropagation()}
                      />

                      <span
                        className="dragDots dragHandle"
                        draggable
                        title=""
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();

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
                      >
                        ⠿
                      </span>

                      <div className="channelNameCell">
                        <ChannelLogo
                          logo={channel.tvgLogo}
                          name={channel.name}
                          size={24}
                        />
                        <span>{channel.name}</span>
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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                    <input
                      value={channelEditForm.tvgLogo}
                      onChange={(event) =>
                        setChannelEditForm({
                          ...channelEditForm,
                          tvgLogo: event.target.value,
                        })
                      }
                    />
                  </label>
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
                style={{ width: 520 }}
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
                    size={96}
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
                        maxWidth: 360,
                      }}
                    >
                      {selectedLogoChannel.tvgLogo || "No logo URL found"}
                    </div>
                  </div>
                </div>

                <div className="modalFooter">
                  <button onClick={closeModals}>Close</button>
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