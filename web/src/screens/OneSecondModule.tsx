import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  Trash2,
  Video,
  X,
  Pause,
  Loader2,
  Film
} from "lucide-react";
import type { Community, OneSecondLog } from "../types";
import { EmptyState, SectionTitle } from "../components/ui";
import { mergeVideos } from "../utils/vlogMerger";

interface OneSecondModuleProps {
  community: Community;
  currentUserId: string;
  onOpenOneSecondUpload: () => void;
  onDeleteOneSecondLog: (logId: string) => void;
  onAddMergedVlogToAlbum: (dateKey: string, videoFile: File) => Promise<void> | void;
}

export function OneSecondModule({
  community,
  currentUserId,
  onOpenOneSecondUpload,
  onDeleteOneSecondLog,
  onAddMergedVlogToAlbum
}: OneSecondModuleProps) {
  // Calendar State
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay(new Date()));
  const [selectedVlogDateKey, setSelectedVlogDateKey] = useState<string | null>(null);

  // Playback State
  const [activeLogIndex, setActiveLogIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [vlogTriggerKey, setVlogTriggerKey] = useState(0); // to force restart animations

  // Merging State
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [selectedBgm, setSelectedBgm] = useState<"none" | "lofi" | "acoustic" | "retro">("lofi");
  const [selectedFilter, setSelectedFilter] = useState<"none" | "rec" | "polaroid">("none");
  const [mergeError, setMergeError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<any | null>(null);

  const todayKey = toDateKey(new Date());

  // Formatted date string for target Vlog
  const formattedVlogDate = useMemo(() => {
    if (!selectedVlogDateKey) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(selectedVlogDateKey));
  }, [selectedVlogDateKey]);

  // Check if a merged Vlog video is already saved in the album
  const mergedVlogItem = useMemo(() => {
    if (!selectedVlogDateKey) return null;
    const album = community.albums.find((a) => a.title === "데일리 Vlog");
    if (!album) return null;

    const targetTitle = `${formattedVlogDate} Vlog`;
    return album.items.find((item) => item.title === targetTitle && item.kind === "video") ?? null;
  }, [community.albums, selectedVlogDateKey, formattedVlogDate]);

  // Check if current user has uploaded today
  const hasUploadedToday = useMemo(() => {
    return community.oneSecondLogs.some(
      (log) =>
        log.userId === currentUserId &&
        toDateKey(new Date(log.createdAt)) === todayKey
    );
  }, [community.oneSecondLogs, currentUserId, todayKey]);

  // Group logs by date
  const logsByDate = useMemo(() => {
    const groups = new Map<string, OneSecondLog[]>();
    community.oneSecondLogs.forEach((log) => {
      const key = toDateKey(new Date(log.createdAt));
      const list = groups.get(key) ?? [];
      list.push(log);
      groups.set(key, list);
    });
    return groups;
  }, [community.oneSecondLogs]);

  // Build calendar days
  const calendarDays = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = startOfWeek(firstDay);
    const lastDay = new Date(year, month + 1, 0);
    const end = endOfWeek(lastDay);

    const days: Date[] = [];
    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDaysLocal(cursor, 1)) {
      days.push(cursor);
    }
    return days;
  }, [anchorDate]);

  // Current Vlog logs
  const currentVlogLogs = useMemo(() => {
    if (!selectedVlogDateKey) return [];
    return (logsByDate.get(selectedVlogDateKey) ?? []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [logsByDate, selectedVlogDateKey]);

  // Handle current index out of bounds on data changes (e.g. deletion)
  useEffect(() => {
    if (selectedVlogDateKey && currentVlogLogs.length === 0) {
      // All logs deleted for this day
      setSelectedVlogDateKey(null);
    } else if (activeLogIndex >= currentVlogLogs.length) {
      setActiveLogIndex(Math.max(0, currentVlogLogs.length - 1));
    }
  }, [currentVlogLogs, selectedVlogDateKey, activeLogIndex]);

  // Sequential Playback Effects
  useEffect(() => {
    if (!selectedVlogDateKey || currentVlogLogs.length === 0 || isFinished) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        // Handle autoplay block gracefully
      });
    } else {
      video.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeLogIndex, isPlaying, selectedVlogDateKey, currentVlogLogs.length, isFinished, vlogTriggerKey]);

  const startOneSecondTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Play for exactly 1000ms
    timerRef.current = setTimeout(() => {
      handleNext();
    }, 1000);
  };

  const handleNext = () => {
    if (activeLogIndex < currentVlogLogs.length - 1) {
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

  const openVlog = (dateKey: string) => {
    setSelectedVlogDateKey(dateKey);
    setActiveLogIndex(0);
    setIsPlaying(true);
    setIsFinished(false);
    setVlogTriggerKey(0);
  };

  const closeVlog = () => {
    setSelectedVlogDateKey(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const restartVlog = () => {
    setActiveLogIndex(0);
    setIsPlaying(true);
    setIsFinished(false);
    setVlogTriggerKey((prev) => prev + 1);
  };

  const handleDelete = (logId: string) => {
    onDeleteOneSecondLog(logId);
  };

  const handleMergeAndSave = async () => {
    if (!selectedVlogDateKey || currentVlogLogs.length === 0) return;
    setIsMerging(true);
    setMergeProgress(0);
    setMergeError(null);

    try {
      const urls = currentVlogLogs.map((log) => log.videoUrl);
      const blob = await mergeVideos(urls, (progress) => {
        setMergeProgress(Math.round(progress * 100));
      }, { bgm: selectedBgm, filter: selectedFilter });

      const filename = `vlog-${selectedVlogDateKey}.webm`;
      const file = new File([blob], filename, { type: blob.type });

      await onAddMergedVlogToAlbum(selectedVlogDateKey, file);
      setIsMerging(false);
    } catch (err) {
      console.error(err);
      setMergeError("비디오 병합에 실패했습니다. 다시 시도해 주세요.");
      setIsMerging(false);
    }
  };

  const moveMonth = (direction: -1 | 1) => {
    setAnchorDate((current) => addMonthsLocal(current, direction));
  };

  const currentMonthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(anchorDate);

  const activeLog = currentVlogLogs[activeLogIndex];

  return (
    <>
      <section className="section text-center fade-rise" style={{ animationDelay: "50ms" }}>
        <div className="vlog-intro-card">
          <div className="vlog-intro-icon">
            <Video aria-hidden="true" />
          </div>
          <h2>1s Vlog</h2>
          <p className="description">
            매일 1초의 비디오를 기록하세요.<br />
            멤버들의 기록이 이어져 오늘 1s가 됩니다.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            {hasUploadedToday ? (
              <div className="vlog-uploaded-badge">
                <span>오늘 1s 완료</span>
              </div>
            ) : (
              <button className="primary-button inline-flex" onClick={onOpenOneSecondUpload}>
                <Plus size={18} style={{ marginRight: "0.25rem" }} />
                오늘 1s 기록
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="section fade-rise" style={{ animationDelay: "150ms" }}>
        <SectionTitle
          title="기록 달력"
          action={
            <div className="section-actions">
              <button
                className="icon-button"
                onClick={() => moveMonth(-1)}
                aria-label="이전 달"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="calendar-month-title" style={{ fontWeight: 600, minWidth: "100px", textAlign: "center" }}>
                {currentMonthLabel}
              </span>
              <button
                className="icon-button"
                onClick={() => moveMonth(1)}
                aria-label="다음 달"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          }
        />

        <div className="vlog-calendar-grid">
          {/* Weekday headers */}
          {["일", "월", "화", "수", "목", "금", "토"].map((dayName) => (
            <div key={dayName} className="calendar-header-cell">
              {dayName}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day) => {
            const dateKey = toDateKey(day);
            const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
            const isToday = dateKey === todayKey;
            const dayLogs = logsByDate.get(dateKey) ?? [];
            const hasLogs = dayLogs.length > 0;

            return (
              <div
                key={dateKey}
                className={`vlog-calendar-day ${!isCurrentMonth ? "is-other-month" : ""} ${isToday ? "is-today" : ""} ${hasLogs ? "has-logs" : ""}`}
              >
                <span className="day-number">{day.getDate()}</span>
                {hasLogs ? (
                  <button
                    className="vlog-play-badge"
                    onClick={() => openVlog(dateKey)}
                    title={`${dayLogs.length}개의 1초 기록 재생`}
                  >
                    <Play size={10} style={{ marginRight: "2px" }} />
                    {dayLogs.length}s
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Vlog Player Modal */}
      {selectedVlogDateKey && currentVlogLogs.length > 0 ? (
        <div className="vlog-player-overlay" onClick={closeVlog} role="dialog" aria-modal="true">
          <div className="vlog-player-container" onClick={(e) => e.stopPropagation()}>
            {/* Top Close Button */}
            <button className="vlog-close-button" onClick={closeVlog} aria-label="플레이어 닫기">
              <X size={24} />
            </button>

            {/* Top Story Progress Bars */}
            <div className="vlog-progress-bar-container">
              {currentVlogLogs.map((log, index) => {
                const isPassed = index < activeLogIndex;
                const isActive = index === activeLogIndex && !isFinished;
                
                return (
                  <div key={log.id} className="vlog-progress-segment">
                    <div
                      key={`${index}-${isPlaying}-${vlogTriggerKey}`} // force rerender on index/play state change
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
            <div className={`vlog-video-wrapper filter-theme-${selectedFilter}`}>
              {!isFinished ? (
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

                  {/* REC 필터 오버레이 */}
                  {selectedFilter === "rec" && (
                    <div className="vlog-filter-overlay-rec">
                      <span className="rec-dot-blink">● REC</span>
                      <span className="rec-time">00:00:01</span>
                    </div>
                  )}

                  {/* 폴라로이드 필터 오버레이 */}
                  {selectedFilter === "polaroid" && (
                    <div className="vlog-filter-overlay-polaroid" />
                  )}

                  {/* Play/Pause Center Indicator (Brief fade-in-out on toggle, or overlay when paused) */}
                  {!isPlaying ? (
                    <div className="vlog-paused-overlay" onClick={togglePlayPause}>
                      <Pause size={48} />
                    </div>
                  ) : null}

                  {/* Previous / Next click target areas */}
                  <div className="vlog-nav-area is-left" onClick={handlePrev} />
                  <div className="vlog-nav-area is-right" onClick={handleNext} />

                  {/* Info Overlay at the bottom */}
                  <div className="vlog-info-overlay">
                    <div className="vlog-info-header">
                      <div className="vlog-user-badge">
                        {activeLog.userInitials}
                      </div>
                      <span className="vlog-user-name">{activeLog.userName}</span>
                      <span className="vlog-timestamp">
                        {formatLogTime(activeLog.createdAt)}
                      </span>

                      {/* Delete Option for Author */}
                      {activeLog.userId === currentUserId ? (
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
                  <h3>오늘의 Vlog를 모두 보았습니다!</h3>
                  <p>{currentVlogLogs.length}명의 멤버가 기록을 남겼습니다.</p>

                  <div className="vlog-merge-section" style={{ margin: "20px 0", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {isMerging ? (
                      <div className="vlog-merge-status" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Loader2 size={32} style={{ animation: "loading-spin 1s linear infinite", color: "var(--primary)", marginBottom: "12px" }} />
                        <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.8)" }}>Vlog 비디오 병합 중... {mergeProgress}%</p>
                      </div>
                    ) : mergedVlogItem ? (
                      <div className="vlog-merge-status" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Film size={32} style={{ color: "var(--primary)", marginBottom: "12px" }} />
                        <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.8)", textAlign: "center" }}>
                          Vlog 비디오가 "데일리 Vlog" 앨범에 저장되었습니다! 🎉
                        </p>
                        {mergedVlogItem.mediaUrl ? (
                          <a
                            href={mergedVlogItem.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="primary-button inline-flex"
                            style={{ textDecoration: "none", marginTop: "12px", padding: "6px 12px", fontSize: "0.85rem" }}
                          >
                            비디오 다운로드
                          </a>
                        ) : null}
                      </div>
                    ) : (
                       selectedVlogDateKey !== todayKey && (
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
                      )
                    )}
                  </div>
                  
                  <div className="vlog-end-actions">
                    <button className="primary-button" onClick={restartVlog}>
                      다시 보기
                    </button>
                    <button className="secondary-button" onClick={closeVlog} style={{ marginLeft: "0.5rem" }}>
                      닫기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Local Helper Functions for Dates
function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function endOfWeek(date: Date) {
  return addDaysLocal(startOfWeek(date), 6);
}

function addDaysLocal(date: Date, days: number) {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsLocal(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
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
