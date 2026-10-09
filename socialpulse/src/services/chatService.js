import api from "./api";

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

export async function listConversations() {
  const res = await api.get("/conversations");
  const list = res.data?.data || res.data || [];
  return list.map((c) => ({
    id: c.id,
    conversationId: c.id,
    name: `Chat (${c.members?.slice(0, 2).join(", ")})`,
    members: c.members || [],
    online: false,
    lastMessage: c.lastMessage?.content || "",
    updatedAt: c.updatedAt,
  }));
}

export async function listMessages(conversationId) {
  const res = await api.get(`/conversations/${conversationId}/messages`);
  const data = res.data?.data || res.data;
  const items = data?.items || (Array.isArray(data) ? data : []);
  return items.map(mapMessage).sort((a, b) => a.ts - b.ts);
}
