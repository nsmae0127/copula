import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from "react";
import { ChevronLeft, MessageCircle, Send, SmilePlus, Users } from "lucide-react";
import { EmptyState } from "../components/ui";
import type { Community, CopulaNotification } from "../types";
import { formatDateTime } from "../utils";

interface MessagesScreenProps {
  communities: Community[];
  currentUserId: string;
  selectedCommunityId: string | null;
  notifications: CopulaNotification[];
  onSelectConversation: (communityId: string) => void;
  onBackToList: () => void;
  onSendMessage: (communityId: string, body: string) => Promise<void> | void;
  onToggleMessageReaction: (communityId: string, messageId: string, emoji: string) => Promise<void> | void;
}

const MESSAGE_REACTION_OPTIONS = ["❤️", "👍", "😂", "🎉"];

export function MessagesScreen({
  communities,
  currentUserId,
  selectedCommunityId,
  notifications,
  onSelectConversation,
  onBackToList,
  onSendMessage,
  onToggleMessageReaction
}: MessagesScreenProps) {
  const selectedCommunity = communities.find((community) => community.id === selectedCommunityId) ?? null;
  const conversations = useMemo(() => {
    return [...communities].sort((a, b) => {
      const aLatest = latestMessageTime(a);
      const bLatest = latestMessageTime(b);
      return bLatest - aLatest;
    });
  }, [communities]);

  if (!communities.length) {
    return (
      <section className="messages-screen">
        <EmptyState icon={MessageCircle} title="대화할 Copula가 없습니다" body="초대 코드로 참여하거나 새 Copula를 만들어 시작하세요." />
      </section>
    );
  }

  if (selectedCommunity) {
    return (
      <ConversationPanel
        community={selectedCommunity}
        currentUserId={currentUserId}
        unreadCount={unreadMessageCountForCommunity(notifications, selectedCommunity.id)}
        onBackToList={onBackToList}
        onSendMessage={(body) => onSendMessage(selectedCommunity.id, body)}
        onToggleMessageReaction={(messageId, emoji) => onToggleMessageReaction(selectedCommunity.id, messageId, emoji)}
      />
    );
  }

  return (
    <section className="messages-screen">
      <div className="messages-screen-head">
        <div>
          <h1>Chat</h1>
        </div>
      </div>

      <div className="conversation-list">
        {conversations.map((community) => {
          const latest = latestMessage(community);
          const unreadCount = unreadMessageCountForCommunity(notifications, community.id);

          return (
            <button
              key={community.id}
              type="button"
              className="conversation-card"
              style={{ "--accent": community.accent } as CSSProperties}
              onClick={() => onSelectConversation(community.id)}
            >
              <span className="conversation-avatar">
                {community.name.charAt(0).toUpperCase()}
              </span>
              <span className="conversation-main">
                <span className="conversation-title-row">
                  <span className="conversation-member-pill" aria-label={`멤버 ${community.members.length}명`}>
                    <Users aria-hidden="true" />
                    {community.members.length}
                  </span>
                  <strong>{community.name}</strong>
                  <small>{latest ? formatRelativeMessageTime(latest.createdAt) : "새 대화"}</small>
                </span>
                <span className="conversation-preview">
                  {latest ? `${latest.senderName}: ${latest.body}` : "아직 메시지가 없습니다."}
                </span>
              </span>
              {unreadCount > 0 ? <span className="conversation-unread">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ConversationPanel({
  community,
  currentUserId,
  unreadCount,
  onBackToList,
  onSendMessage,
  onToggleMessageReaction
}: {
  community: Community;
  currentUserId: string;
  unreadCount: number;
  onBackToList: () => void;
  onSendMessage: (body: string) => Promise<void> | void;
  onToggleMessageReaction: (messageId: string, emoji: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number; tracking: boolean } | null>(null);
  const messages = [...community.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [community.id, messages.length]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;

    setPending(true);
    setError(null);
    try {
      await onSendMessage(body);
      setDraft("");
      setReactionTargetId(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "메시지를 보내지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setError(null);
    try {
      await onToggleMessageReaction(messageId, emoji);
      setReactionTargetId(null);
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "반응을 저장하지 못했습니다.");
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      tracking: event.clientX <= 44
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const start = swipeStartRef.current;
    if (!start?.tracking) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX > 72 && Math.abs(deltaY) < 54) {
      swipeStartRef.current = null;
      onBackToList();
    }
  }

  function clearSwipeTracking() {
    swipeStartRef.current = null;
  }

  return (
    <section
      className="messages-module messages-screen-chat"
      aria-label={`${community.name} 메시지`}
      style={{ "--accent": community.accent } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearSwipeTracking}
      onPointerCancel={clearSwipeTracking}
    >
      <div className="messages-head messages-chat-head">
        <button className="icon-button compact" type="button" onClick={onBackToList} aria-label="대화 목록">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <span className="messages-title-line">
            <span className="conversation-member-pill" aria-label={`멤버 ${community.members.length}명`}>
              <Users aria-hidden="true" />
              {community.members.length}
            </span>
            <h2>{community.name}</h2>
          </span>
          {unreadCount > 0 ? <span>읽지 않음 {unreadCount}</span> : null}
        </div>
        <span className="messages-count-pill">{messages.length}</span>
      </div>

      <div className="messages-list" ref={listRef}>
        {messages.length ? (
          messages.map((message) => {
            const mine = message.senderUserId === currentUserId;
            const groupedReactions = groupMessageReactions(message.reactions, currentUserId);

            return (
              <article key={message.id} className={`message-row ${mine ? "is-mine" : "is-other"}`}>
                {!mine ? <span className="message-avatar">{message.senderInitials}</span> : null}
                <div className="message-cluster">
                  {!mine ? <span className="message-sender">{message.senderName}</span> : null}
                  <button
                    type="button"
                    className="message-bubble"
                    onClick={() => setReactionTargetId((current) => current === message.id ? null : message.id)}
                    aria-label={`${message.senderName} 메시지에 반응 추가`}
                  >
                    {message.body}
                  </button>
                  <div className="message-meta">
                    <span>{formatDateTime(message.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => setReactionTargetId((current) => current === message.id ? null : message.id)}
                    >
                      <SmilePlus aria-hidden="true" />
                      반응
                    </button>
                  </div>

                  {groupedReactions.length ? (
                    <div className="message-reactions" aria-label="메시지 반응">
                      {groupedReactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          className={reaction.mine ? "is-mine" : ""}
                          onClick={() => toggleReaction(message.id, reaction.emoji)}
                          aria-pressed={reaction.mine}
                        >
                          <span>{reaction.emoji}</span>
                          <strong>{reaction.count}</strong>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {reactionTargetId === message.id ? (
                    <div className="message-reaction-picker" role="group" aria-label="반응 선택">
                      {MESSAGE_REACTION_OPTIONS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => toggleReaction(message.id, emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState icon={MessageCircle} title="아직 메시지가 없습니다" body={`${community.name} 멤버들과 첫 메시지를 나눠보세요.`} />
        )}
      </div>

      <form className="message-composer" onSubmit={submitMessage}>
        <textarea
          value={draft}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={2000}
          placeholder={`${community.name}에 메시지 보내기`}
          aria-label="메시지 입력"
        />
        <button className="primary-button" type="submit" disabled={!draft.trim() || pending}>
          <Send aria-hidden="true" />
          {pending ? "전송 중" : "전송"}
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </section>
  );
}

function latestMessage(community: Community) {
  return [...community.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function latestMessageTime(community: Community) {
  return latestMessage(community) ? new Date(latestMessage(community)!.createdAt).getTime() : new Date(community.createdAt).getTime();
}

function unreadMessageCountForCommunity(notifications: CopulaNotification[], communityId: string) {
  return notifications.filter(
    (item) => item.kind === "message" && !item.read && item.communityId === communityId
  ).length;
}

function groupMessageReactions(reactions: Community["messages"][number]["reactions"], currentUserId: string) {
  return MESSAGE_REACTION_OPTIONS.map((emoji) => {
    const matches = reactions.filter((reaction) => reaction.emoji === emoji);
    return {
      emoji,
      count: matches.length,
      mine: matches.some((reaction) => reaction.userId === currentUserId)
    };
  }).filter((reaction) => reaction.count > 0);
}

function formatRelativeMessageTime(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
