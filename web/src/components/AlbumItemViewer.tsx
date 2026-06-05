import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Image, Share2, X } from "lucide-react";
import type { AlbumItem } from "../types";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { formatDateTime } from "../utils";

interface AlbumItemViewerProps {
  item: AlbumItem;
  albumTitle: string;
  communityName: string;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export function AlbumItemViewer({
  item,
  albumTitle,
  communityName,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  onClose
}: AlbumItemViewerProps) {
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);

  useDialogFocusTrap(dialogRef, onClose);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && hasPrevious) {
        onPrevious?.();
      }
      if (event.key === "ArrowRight" && hasNext) {
        onNext?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasNext, hasPrevious, onNext, onPrevious]);

  async function shareItem() {
    const url = item.mediaUrl && !item.mediaUrl.startsWith("data:") ? item.mediaUrl : "";
    const text = `${communityName} · ${albumTitle} · ${item.title}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text,
          url: url || undefined
        });
        return;
      }

      await navigator.clipboard?.writeText(url || text);
      setMessage(url ? "공유 링크를 복사했습니다." : "사진·메모 정보를 복사했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setMessage("공유를 완료하지 못했습니다.");
    }
  }

  return (
    <div
      className="viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={dialogRef} className="viewer" role="dialog" aria-modal="true" aria-label={item.title}>
        <div className="viewer-head">
          <div className="row-main">
            <strong>{item.title}</strong>
            <span>
              {communityName} · {albumTitle}
            </span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="viewer-media">
          {hasPrevious ? (
            <button className="viewer-nav previous" onClick={onPrevious} aria-label="이전 사진" title="이전 사진">
              <ChevronLeft aria-hidden="true" />
            </button>
          ) : null}
          {item.mediaUrl ? (
            item.kind === "video" ? (
              <video
                src={item.mediaUrl}
                controls
                playsInline
                style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)" }}
              />
            ) : (
              <img src={item.mediaUrl} alt={item.title} />
            )
          ) : (
            <div className="viewer-placeholder">
              <Image aria-hidden="true" />
            </div>
          )}
          {hasNext ? (
            <button className="viewer-nav next" onClick={onNext} aria-label="다음 사진" title="다음 사진">
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="viewer-meta">
          <span>{item.kind === "video" ? "비디오" : item.kind === "photo" ? "사진" : "메모"}</span>
          <span>{item.ownerName}</span>
          <span>{formatDateTime(item.createdAt)}</span>
        </div>

        {message ? <p className="status-banner">{message}</p> : null}

        <div className="button-pair">
          <button className="secondary-button" onClick={() => void shareItem()}>
            <Share2 aria-hidden="true" />
            공유
          </button>
          {item.mediaUrl ? (
            <a className="primary-button" href={item.mediaUrl} download={`${safeFileName(item.title)}.${item.kind === "video" ? "webm" : "jpg"}`}>
              <Download aria-hidden="true" />
              저장
            </a>
          ) : (
            <button className="primary-button" disabled>
              <Download aria-hidden="true" />
              저장
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function safeFileName(value: string) {
  return value.trim().replace(/[^\w가-힣-]+/g, "-").replace(/-+/g, "-") || "copula-album";
}
