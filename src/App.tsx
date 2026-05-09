import { useMemo, useState } from "react";
import "./App.css";

type Channel = {
  id: string;
  name: string;
  group: string;
  url: string;
  rawInfo: string;
};

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
          : "Unnamed channel";

      const groupMatch = line.match(/group-title="([^"]*)"/i);

      channels.push({
        id: crypto.randomUUID(),
        name: channelName,
        group: groupMatch?.[1]?.trim() || "No Group",
        url,
        rawInfo: line,
      });
    }
  }

  return channels;
}

function updateGroupInRawInfo(rawInfo: string, newGroup: string): string {
  if (rawInfo.match(/group-title="[^"]*"/i)) {
    return rawInfo.replace(/group-title="[^"]*"/i, `group-title="${newGroup}"`);
  }

  const commaIndex = rawInfo.lastIndexOf(",");

  if (commaIndex >= 0) {
    return (
      rawInfo.slice(0, commaIndex) +
      ` group-title="${newGroup}"` +
      rawInfo.slice(commaIndex)
    );
  }

  return `${rawInfo} group-title="${newGroup}"`;
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

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Channels");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedChannelIds, setDraggedChannelIds] = useState<string[]>([]);
  const [dragOverGroup, setDragOverGroup] = useState("");

  const groups = useMemo(() => {
    return Array.from(new Set(channels.map((channel) => channel.group))).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return channels.filter((channel) => {
      const matchesGroup =
        selectedGroup === "All Channels" || channel.group === selectedGroup;

      const matchesSearch =
        !search ||
        channel.name.toLowerCase().includes(search) ||
        channel.group.toLowerCase().includes(search) ||
        channel.url.toLowerCase().includes(search);

      return matchesGroup && matchesSearch;
    });
  }, [channels, selectedGroup, searchText]);

  const allVisibleSelected =
    filteredChannels.length > 0 &&
    filteredChannels.every((channel) => selectedChannelIds.includes(channel.id));

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
      setDraggedChannelIds([]);
      setDragOverGroup("");
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
    const visibleIds = filteredChannels.map((channel) => channel.id);

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
    setDraggedChannelIds([]);
    setDragOverGroup("");
  }

  function moveSelectedToGroup(groupName: string) {
    moveChannelsToGroup(selectedChannelIds, groupName);
  }

  function createNewGroupAndMove() {
    moveSelectedToGroup(newGroupName);
  }

  function startDraggingChannel(channelId: string) {
    if (selectedChannelIds.includes(channelId)) {
      setDraggedChannelIds(selectedChannelIds);
      return;
    }

    setDraggedChannelIds([channelId]);
  }

  function dropChannelsOnGroup(groupName: string) {
    if (draggedChannelIds.length === 0) {
      return;
    }

    moveChannelsToGroup(draggedChannelIds, groupName);
  }

  function getDragText() {
    if (draggedChannelIds.length === 0) {
      return "";
    }

    if (draggedChannelIds.length === 1) {
      return "Drop to move 1 channel";
    }

    return `Drop to move ${draggedChannelIds.length.toLocaleString()} channels`;
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Moses M3U Editor</h1>
          <p>Edit your M3U playlist locally in your browser.</p>
        </div>
      </header>

      <section className="uploadBox">
        <div>
          <h2>Upload your M3U file</h2>
          <p>Your file stays on your computer. Nothing is uploaded online.</p>
        </div>

        <input
          type="file"
          accept=".m3u,.m3u8,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </section>

      {channels.length > 0 && (
        <section className="playlistInfo">
          <div>
            <strong>{fileName}</strong>
            <span>{channels.length.toLocaleString()} channels loaded</span>
          </div>

          <button onClick={() => exportM3U(channels, fileName)}>
            Export edited M3U
          </button>
        </section>
      )}

      {channels.length > 0 && (
        <section className="editorLayout">
          <aside className="groupsPanel">
            <div className="panelTitle">
              <h2>Groups</h2>
              <span>{groups.length}</span>
            </div>

            <button
              className={
                selectedGroup === "All Channels"
                  ? "groupButton active"
                  : "groupButton"
              }
              onClick={() => setSelectedGroup("All Channels")}
            >
              <span>All Channels</span>
              <strong>{channels.length.toLocaleString()}</strong>
            </button>

            <div className="dragHint">
              Tip: drag selected channels onto a group.
            </div>

            <div className="groupList">
              {groups.map((group) => {
                const count = channels.filter(
                  (channel) => channel.group === group
                ).length;

                const className = [
                  "groupButton",
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
                      setDragOverGroup(group);
                    }}
                    onDragLeave={() => setDragOverGroup("")}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropChannelsOnGroup(group);
                    }}
                  >
                    <span>{group}</span>
                    <strong>{count.toLocaleString()}</strong>

                    {dragOverGroup === group && draggedChannelIds.length > 0 && (
                      <em>{getDragText()}</em>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="channelsPanel">
            <div className="toolbar">
              <div className="toolbarTop">
                <div>
                  <h2>{selectedGroup}</h2>
                  <p>
                    Showing {filteredChannels.length.toLocaleString()} channels
                    {selectedChannelIds.length > 0 &&
                      ` • ${selectedChannelIds.length.toLocaleString()} selected`}
                  </p>
                </div>

                <button className="secondaryButton" onClick={clearSelection}>
                  Clear selection
                </button>
              </div>

              <div className="toolbarControls">
                <input
                  className="searchInput"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search channels, groups or URLs..."
                />

                <button onClick={toggleAllVisible}>
                  {allVisibleSelected ? "Unselect visible" : "Select visible"}
                </button>

                <select
                  value=""
                  disabled={selectedChannelIds.length === 0}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) moveSelectedToGroup(value);
                  }}
                >
                  <option value="">Move selected to...</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>

                <input
                  className="newGroupInput"
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="New group name"
                />

                <button
                  disabled={
                    selectedChannelIds.length === 0 || !newGroupName.trim()
                  }
                  onClick={createNewGroupAndMove}
                >
                  Create group + move
                </button>
              </div>
            </div>

            <div className="channelList">
              {filteredChannels.slice(0, 500).map((channel) => {
                const isSelected = selectedChannelIds.includes(channel.id);

                return (
                  <label
                    key={channel.id}
                    className={isSelected ? "channelRow selected" : "channelRow"}
                    draggable
                    onDragStart={(event) => {
                      startDraggingChannel(channel.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", channel.id);
                    }}
                    onDragEnd={() => {
                      setDraggedChannelIds([]);
                      setDragOverGroup("");
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleChannel(channel.id)}
                    />

                    <div className="channelDetails">
                      <strong>{channel.name}</strong>
                      <span>{channel.group}</span>
                      <small>{channel.url}</small>
                    </div>
                  </label>
                );
              })}

              {filteredChannels.length > 500 && (
                <div className="limitNotice">
                  Showing first 500 results. Use search or group filters to narrow
                  the list.
                </div>
              )}

              {filteredChannels.length === 0 && (
                <div className="emptyState">No channels found.</div>
              )}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}