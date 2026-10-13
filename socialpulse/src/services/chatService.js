import api from "./api";
import { getUser } from "./usersService";

// Conversations only carry member ids, so resolve the other participant once and cache it.
const profiles = new Map();
export async function resolveProfile(id) {
  if (!id) return null;
  if (profiles.has(id)) return profiles.get(id);
  const p = await getUser(id).catch(() => null);
  profiles.set(id, p);
  return p;
}
export const displayNameOf = (p, id) => p?.displayName || p?.handle || (id ? `User ${id.slice(0, 6)}` : "Chat");
export const initialsOf = (name) => (name || "?").trim().slice(0, 2).toUpperCase();

export function mapMessage(m) {
  if (!m) return null;
  return {
    id: m.id || m._id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.content !== undefined ? m.content : (m.text || ""),
    ts: m.createdAt ? new Date(m.createdAt).getTime() : (m.ts || Date.now()),
    status: m.status || "sent",
    reactions: m.reactions || [],
  };
}

export async function createConversation(otherUserId) {
  const res = await api.post(`/conversations/direct/${otherUserId}`);
  const data = res.data?.data || res.data;
  return data;
}

export async function listConversations(meId) {
  const res = await api.get("/conversations");
  const list = res.data?.data || res.data || [];
  return Promise.all(list.map(async (c) => {
    const members = c.members || [];
    const otherId = members.find((m) => m !== meId) ?? members[0];
    const p = await resolveProfile(otherId);
    return {
      id: c.id,
      conversationId: c.id,
      userId: otherId,
      name: displayNameOf(p, otherId),
      avatarUrl: p?.avatarUrl || null,
      members,
      online: false,
      lastMessage: c.lastMessage?.content || "",
      updatedAt: c.updatedAt,
    };
  }));
}

export async function listMessages(conversationId) {
  const res = await api.get(`/conversations/${conversationId}/messages`);
  const data = res.data?.data || res.data;
  const items = data?.items || (Array.isArray(data) ? data : []);
  return items.map(mapMessage).sort((a, b) => a.ts - b.ts);
}
