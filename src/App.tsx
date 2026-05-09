import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
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

function updateGroupInRawInfo(rawInfo: string, newGroup: string): string {
  return setAttribute(rawInfo, "group-title", newGroup);
}

function exportM3U(channels: Channel[], originalFileName: string) {
  let output = "#EXTM3U\n";

  for (const channel of channels) {
    const updatedInfo = updateGroupInRawInfo(channel.rawInfo, channel.group);
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

function createDragPreview(text: string) {
  const preview = document.createElement("div");
  preview.className = "dragPreview";
  preview.textContent = text;
  document.body.appendChild(preview);
  return preview;
}

function getRowDropPosition(
  event: DragEvent<HTMLDivElement>
): "above" | "below" {
  const rect = event.currentTarget.getBoundingClientRect();
  const middle = rect.top + rect.height / 2;
  return event.clientY < middle ? "above" : "below";
}

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Channels");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedChannelIds, setDraggedChannelIds] = useState<string[]>([]);
  const [dragOverGroup, setDragOverGroup] = useState("");

  const channelListRef = useRef<HTMLDivElement | null>(null);
  const dropIndicatorRef = useRef<HTMLDivElement | null>(null);
  const currentDropTargetRef = useRef<DropTarget | null>(null);

  const selectedChannelSet = useMemo(() => {
    return new Set(selectedChannelIds);
  }, [selectedChannelIds]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const orderedGroups: string[] = [];

    for (const channel of channels) {
      if (!seen.has(channel.group)) {
        seen.add(channel.group);
        orderedGroups.push(channel.group);
      }
    }

    return orderedGroups;
  }, [channels]);

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
    setDragOverGroup("");
    hideDropIndicator();
  }

  function handleFile(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");
      const parsedChannels = parseM3U(text);

      setChannels(parsedChannels);
      setFileName(file.name);
      setSelectedGroup("All Channels");
      setSelectedChannelIds([]);
      setSearchText("");
      setNewGroupName("");
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
  }

  function moveChannelsToGroup(channelIds: string[], groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName || channelIds.length === 0) {
      return;
    }

    setChannels((current) =>
      current.map((channel) =>
        channelIds.includes(channel.id)
          ? {
              ...channel,
              group: cleanGroupName,
              rawInfo: updateGroupInRawInfo(channel.rawInfo, cleanGroupName),
            }
          : channel
      )
    );

    setSelectedGroup(cleanGroupName);
    setSelectedChannelIds([]);
    setNewGroupName("");
    resetDragState();
  }

  function copyChannelsToGroup(channelIds: string[], groupName: string) {
    const cleanGroupName = groupName.trim();

    if (!cleanGroupName || channelIds.length === 0) {
      return;
    }

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

      return [...current, ...copiedChannels];
    });

    setSelectedGroup(cleanGroupName);
    setSelectedChannelIds([]);
    setNewGroupName("");
    resetDragState();
  }

  function createNewGroupAndCopy() {
    copyChannelsToGroup(selectedChannelIds, newGroupName);
  }

  function createNewGroupAndMove() {
    moveChannelsToGroup(selectedChannelIds, newGroupName);
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

  function getDragText() {
    if (draggedChannelIds.length === 0) {
      return "";
    }

    if (draggedChannelIds.length === 1) {
      return "Copy 1 channel";
    }

    return `Copy ${draggedChannelIds.length.toLocaleString()} channels`;
  }

  return (
    <main className="app">
      <header className="topBar">
        <div className="brand">
          <div className="logoMark">M</div>
          <div>
            <h1>Moses M3U Editor</h1>
            <p>Local browser playlist editor</p>
          </div>
        </div>

        <div className="topActions">
          <label className="importButton">
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
            className="primaryButton"
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

              <button onClick={toggleAllVisible}>
                {allVisibleSelected ? "Unselect visible" : "Select visible"}
              </button>

              <button onClick={clearSelection}>Clear</button>
            </div>
          </section>

          <section className="editorLayout">
            <aside className="groupsPanel">
              <div className="panelHeader">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedGroup === "All Channels"}
                    onChange={() => setSelectedGroup("All Channels")}
                  />
                  <strong>Groups</strong>
                  <span>{groups.length}</span>
                </label>

                <div className="miniButtons">
                  <button title="Add group">+</button>
                  <button title="Group options">⋮</button>
                </div>
              </div>

              <button
                className={
                  selectedGroup === "All Channels"
                    ? "groupRow active"
                    : "groupRow"
                }
                onClick={() => setSelectedGroup("All Channels")}
              >
                <span className="dragDots">⠿</span>
                <span>All Channels</span>
                <em>{channels.length.toLocaleString()}</em>
              </button>

              <div className="groupList">
                {groups.map((group) => {
                  const count = groupCounts.get(group) || 0;

                  const className = [
                    "groupRow",
                    selectedGroup === group ? "active" : "",
                    dragOverGroup === group ? "dragOver" : "",
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
                        if (dragOverGroup !== group) {
                          setDragOverGroup(group);
                        }
                      }}
                      onDragLeave={() => setDragOverGroup("")}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropChannelsOnGroup(group);
                      }}
                    >
                      <span className="dragDots">⠿</span>
                      <span className="groupName">{group}</span>
                      <em>{count.toLocaleString()}</em>

                      {dragOverGroup === group && draggedChannelIds.length > 0 && (
                        <small>{getDragText()}</small>
                      )}
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

                <div className="miniButtons">
                  <button
                    disabled={selectedChannelIds.length === 0}
                    onClick={createNewGroupAndCopy}
                    title="Copy selected to new group"
                  >
                    Copy +
                  </button>

                  <button
                    disabled={selectedChannelIds.length === 0}
                    onClick={createNewGroupAndMove}
                    title="Move selected to new group"
                  >
                    Move +
                  </button>

                  <button title="More actions">⋮</button>
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
                        title="Drag channel"
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
                        <div className="channelIcon">▣</div>
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
        </>
      )}
    </main>
  );
}