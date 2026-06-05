import { useState, useEffect, useRef, useMemo } from "react";
import { X, Play, Pause, Trash2, Film, Loader2 } from "lucide-react";
import type { OneSecondLog } from "../types";
import { mergeVideos } from "../utils/vlogMerger";

interface OneSecondPlayerOverlayProps {
  logs: OneSecondLog[];
  dateKey: string;
  dateLabel: string;
  currentUserId: string;
  onClose: () => void;
  onDeleteLog?: (logId: string) => void;
  hasSavedVlog?: boolean;
  onAddMergedVlogToAlbum?: (dateKey: string, videoFile: File) => Promise<void> | void;
  showMergeOption?: boolean;
}

export function OneSecondPlayerOverlay({
  logs,
  dateKey,
  dateLabel,
  currentUserId,
  onClose,
  onDeleteLog,
  hasSavedVlog = false,
  onAddMergedVlogToAlbum,
  showMergeOption = false
}: OneSecondPlayerOverlayProps) {
  const [activeLogIndex, setActiveLogIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [vlogTriggerKey, setVlogTriggerKey] = useState(0);

  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [selectedBgm, setSelectedBgm] = useState<"none" | "lofi" | "acoustic" | "retro">("lofi");
  const [selectedFilter, setSelectedFilter] = useState<"none" | "rec" | "polaroid">("none");
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(hasSavedVlog);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<any | null>(null);
  const todayKey = toDateKey(new Date());

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [logs]);

  const activeLog = sortedLogs[activeLogIndex];

  useEffect(() => {
    if (sortedLogs.length === 0 || isFinished) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        // Autoplay fallback
      });
    } else {
      video.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeLogIndex, isPlaying, sortedLogs.length, isFinished, vlogTriggerKey]);

  // Handle data updates (e.g. log deleted)
  useEffect(() => {
    if (sortedLogs.length === 0) {
      onClose();
    } else if (activeLogIndex >= sortedLogs.length) {
      setActiveLogIndex(Math.max(0, sortedLogs.length - 1));
    }
  }, [sortedLogs.length, activeLogIndex, onClose]);

  const startOneSecondTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleNext();
    }, 1000);
  };

  const handleNext = () => {
    if (activeLogIndex < sortedLogs.length - 1) {
      setActiveLogIndex((prev) => prev + 1);
      setVlogTriggerKey((prev) => prev + 1);
    } else {
      setIsFinished(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  };

  const handlePrev = () => {
    if (activeLogIndex > 0) {
      setActiveLogIndex((prev) => prev - 1);
      setVlogTriggerKey((prev) => prev + 1);
      setIsFinished(false);
    }
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const restartVlog = () => {
    setActiveLogIndex(0);
    setIsPlaying(true);
    setIsFinished(false);
    setVlogTriggerKey((prev) => prev + 1);
  };

  const handleDelete = (logId: string) => {
    if (onDeleteLog) {
      onDeleteLog(logId);
    }
  };

  const handleMergeAndSave = async () => {
    if (sortedLogs.length === 0 || !onAddMergedVlogToAlbum) return;
    setIsMerging(true);
    setMergeProgress(0);
    setMergeError(null);

    try {
      const urls = sortedLogs.map((log) => log.videoUrl);
      const blob = await mergeVideos(urls, (progress) => {
        setMergeProgress(Math.round(progress * 100));
      }, { bgm: selectedBgm, filter: selectedFilter });

      const filename = `vlog-${dateKey}.webm`;
      const file = new File([blob], filename, { type: blob.type });

      await onAddMergedVlogToAlbum(dateKey, file);
      setSavedSuccess(true);
      setIsMerging(false);
    } catch (err) {
      console.error(err);
      setMergeError("비디오 병합에 실패했습니다. 다시 시도해 주세요.");
      setIsMerging(false);
    }
  };

  if (sortedLogs.length === 0) return null;

  return (
    <div className="vlog-player-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vlog-player-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Close Button */}
        <button className="vlog-close-button" onClick={onClose} aria-label="플레이어 닫기">
          <X size={24} />
        </button>

        {/* Top Story Progress Bars */}
        <div className="vlog-progress-bar-container">
          {sortedLogs.map((log, index) => {
            const isPassed = index < activeLogIndex;
            const isActive = index === activeLogIndex && !isFinished;

            return (
              <div key={log.id} className="vlog-progress-segment">
                <div
                  key={`${index}-${isPlaying}-${vlogTriggerKey}`}
                  className={`vlog-progress-fill ${isPassed ? "is-passed" : ""} ${isActive && isPlaying ? "is-playing" : ""}`}
                  style={{
                    width: isPassed ? "100%" : "0%"
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Video & Playback Card */}
        <div className="vlog-video-wrapper">
          {!isFinished && activeLog ? (
            <>
              <video
                ref={videoRef}
                key={activeLog.id}
                src={activeLog.videoUrl}
                autoPlay
                muted
                playsInline
                onPlay={startOneSecondTimer}
                onEnded={handleNext}
                onClick={togglePlayPause}
                className="vlog-video-element"
              />

              {!isPlaying ? (
                <div className="vlog-paused-overlay" onClick={togglePlayPause}>
                  <Pause size={48} />
                </div>
              ) : null}

              {/* Prev / Next hot areas */}
              <div className="vlog-nav-area is-left" onClick={handlePrev} />
              <div className="vlog-nav-area is-right" onClick={handleNext} />

              {/* Info Overlay */}
              <div className="vlog-info-overlay">
                <div className="vlog-info-header">
                  <div className="vlog-user-badge">
                    {activeLog.userInitials}
                  </div>
                  <span className="vlog-user-name">{activeLog.userName}</span>
                  <span className="vlog-timestamp">
                    {formatLogTime(activeLog.createdAt)}
                  </span>

                  {activeLog.userId === currentUserId && onDeleteLog ? (
                    <button
                      className="vlog-delete-button"
                      onClick={() => handleDelete(activeLog.id)}
                      title="내 영상 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>

                {activeLog.caption ? (
                  <p className="vlog-caption">{activeLog.caption}</p>
                ) : null}
              </div>
            </>
          ) : (
            /* End Screen */
            <div className="vlog-end-screen">
              <h3>{dateLabel} Vlog를 모두 보았습니다!</h3>
              <p>{sortedLogs.length}명의 멤버가 기록을 남겼습니다.</p>

              {showMergeOption && onAddMergedVlogToAlbum && (
                <div className="vlog-merge-section" style={{ margin: "20px 0", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {isMerging ? (
                    <div className="vlog-merge-status" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <Loader2 size={32} style={{ animation: "loading-spin 1s linear infinite", color: "var(--primary)", marginBottom: "12px" }} />
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.8)" }}>Vlog 비디오 병합 중... {mergeProgress}%</p>
                    </div>
                  ) : savedSuccess ? (
                    <div className="vlog-merge-status" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <Film size={32} style={{ color: "var(--primary)", marginBottom: "12px" }} />
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.8)", textAlign: "center" }}>
                        Vlog 비디오가 "데일리 Vlog" 앨범에 저장되었습니다! 🎉
                      </p>
                    </div>
                  ) : dateKey !== todayKey ? (
                    <div className="vlog-merge-options-form" style={{ width: "100%", maxWidth: "320px", marginBottom: "16px", textAlign: "left" }}>
                      <div className="form-group" style={{ marginBottom: "12px" }}>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: "4px" }}>배경 음악 (BGM)</label>
                        <select 
                          value={selectedBgm} 
                          onChange={(e) => setSelectedBgm(e.target.value as any)}
                          style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.4)", color: "white", fontSize: "0.82rem" }}
                        >
                          <option value="none">음악 없음 (무음)</option>
                          <option value="lofi">Chill Lo-fi Beat 🎵</option>
                          <option value="acoustic">Warm Acoustic Guitar 🎸</option>
                          <option value="retro">Retro Tape Jazz 📻</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: "4px" }}>화면 테마 필터</label>
                        <select 
                          value={selectedFilter} 
                          onChange={(e) => setSelectedFilter(e.target.value as any)}
                          style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.4)", color: "white", fontSize: "0.82rem" }}
                        >
                          <option value="none">필터 없음 (기본)</option>
                          <option value="rec">빈티지 캠코더 (● REC) 📹</option>
                          <option value="polaroid">감성 폴라로이드 프레임 📸</option>
                        </select>
                      </div>
                      
                      <button className="primary-button inline-flex w-full" onClick={handleMergeAndSave} style={{ fontSize: "0.85rem", padding: "10px 16px", justifyContent: "center" }}>
                        <Film size={16} style={{ marginRight: "6px" }} />
                        선택한 스타일로 병합 후 저장
                      </button>
                      {mergeError ? (
                        <p style={{ color: "var(--danger)", fontSize: "0.8rem", margin: "8px 0 0", textAlign: "center" }}>{mergeError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.6)", textAlign: "center" }}>
                      하루 비디오는 다음날 합쳐서 보관할 수 있습니다.
                    </p>
                  )}
                </div>
              )}

              <div className="vlog-end-actions">
                <button className="primary-button" onClick={restartVlog}>
                  다시 보기
                </button>
                <button className="secondary-button" onClick={onClose} style={{ marginLeft: "0.5rem" }}>
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLogTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}
