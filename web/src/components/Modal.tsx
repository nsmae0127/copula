import type { CSSProperties, FormEvent } from "react";
import { useRef, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  Clock,
  FileText,
  Flag,
  Heart,
  Image,
  KeyRound,
  MapPin,
  Megaphone,
  Palette,
  Plane,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
  X,
  type LucideIcon
} from "lucide-react";
import type {
  AlbumItemInput,
  AlbumItemUpdateInput,
  CalendarEvent,
  Community,
  DDayItem,
  JoinResult,
  ModalType,
  Notice
} from "../types";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { addDays, toInputDate } from "../utils";

interface ModalState {
  type: ModalType;
  albumId?: string;
  inviteCode?: string;
  eventDate?: string;
  eventId?: string;
  noticeId?: string;
  itemId?: string;
  ddayId?: string;
}

interface ModalProps {
  modal: ModalState;
  selectedCommunity: Community | null;
  selectedAlbumId: string | null;
  canDeleteCommunity: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<JoinResult>;
  onCreateCommunity: (name: string, description: string) => Promise<void> | void;
  onUpdateCommunity: (
    communityId: string,
    input: { name: string; description: string; accent: string; coverFile?: File; coverUrl?: string | null }
  ) => Promise<void> | void;
  onRequestDeleteCommunity: () => void;
  onAddNotice: (communityId: string, notice: Omit<Notice, "id" | "createdAt">) => Promise<void> | void;
  onAddEvent: (communityId: string, event: {
    title: string;
    notes: string;
    location: string;
    startsAt: string;
  }) => Promise<void> | void;
  onAddAlbum: (communityId: string, album: { title: string; description: string }) => Promise<string> | string;
  onAddAlbumItem: (communityId: string, albumId: string, input: AlbumItemInput) => Promise<void> | void;
  onAddDDay: (communityId: string, dday: Omit<DDayItem, "id">) => Promise<void> | void;
  onUpdateEvent: (
    communityId: string,
    eventId: string,
    event: Omit<CalendarEvent, "id" | "createdAt">
  ) => Promise<void> | void;
  onUpdateAlbum: (
    communityId: string,
    albumId: string,
    album: { title: string; description: string }
  ) => Promise<void> | void;
  onUpdateAlbumItem: (
    communityId: string,
    albumId: string,
    itemId: string,
    input: AlbumItemUpdateInput
  ) => Promise<void> | void;
  onUpdateDDay: (communityId: string, ddayId: string, dday: Omit<DDayItem, "id">) => Promise<void> | void;
  onUpdateNotice: (
    communityId: string,
    noticeId: string,
    notice: Omit<Notice, "id" | "createdAt">
  ) => Promise<void> | void;
  onAlbumCreated: (albumId: string) => void;
  onJoinedCommunity: (result?: JoinResult) => void;
  onAddOneSecondLog?: (
    communityId: string,
    input: { file: File; caption: string }
  ) => Promise<void> | void;
}

const titles: Record<ModalType, string> = {
  join: "copula 참여",
  community: "copula 만들기",
  communityEdit: "copula 설정",
  notice: "공지 작성",
  noticeEdit: "공지 수정",
  event: "일정 추가",
  eventEdit: "일정 수정",
  album: "앨범 만들기",
  albumEdit: "앨범 수정",
  albumItem: "사진·메모 추가",
  albumItemEdit: "사진·메모 수정",
  dday: "D-Day 추가",
  ddayEdit: "D-Day 수정",
  "1sUpload": "1초 영상 업로드"
};

const accentOptions = [
  { label: "Coral", value: "#f0717a" },
  { label: "Lavender", value: "#8c74ba" },
  { label: "Pink", value: "#f6a8be" },
  { label: "Peach", value: "#ffd6c7" },
  { label: "Teal", value: "#6fb7a5" }
];

const communityPresets = [
  {
    icon: Heart,
    label: "가족",
    name: "가족 모임",
    description: "가족 일정과 약속을 함께 관리합니다."
  },
  {
    icon: Plane,
    label: "여행",
    name: "여행 준비",
    description: "일정, 사진, 준비할 일을 한곳에 모읍니다."
  },
  {
    icon: Users,
    label: "친구",
    name: "친구 모임",
    description: "모임 일정과 추억을 함께 기록합니다."
  },
  {
    icon: Briefcase,
    label: "팀",
    name: "프로젝트 팀",
    description: "역할, 일정, 약속을 관계별로 정리합니다."
  }
];

export function Modal({
  modal,
  selectedCommunity,
  selectedAlbumId,
  canDeleteCommunity,
  onClose,
  onJoin,
  onCreateCommunity,
  onUpdateCommunity,
  onRequestDeleteCommunity,
  onAddNotice,
  onAddEvent,
  onAddAlbum,
  onAddAlbumItem,
  onAddDDay,
  onUpdateEvent,
  onUpdateAlbum,
  onUpdateAlbumItem,
  onUpdateDDay,
  onUpdateNotice,
  onAlbumCreated,
  onJoinedCommunity,
  onAddOneSecondLog
}: ModalProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useDialogFocusTrap(dialogRef, onClose);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      if (modal.type === "join") {
        const result = await onJoin(String(data.inviteCode ?? ""));
        if (result.status === "invalidCode") {
          setError("유효하지 않은 초대 코드입니다.");
          setIsSubmitting(false);
          return;
        }
        if (result.status === "needsSignIn") {
          setError("로그인 후 참여할 수 있습니다.");
          setIsSubmitting(false);
          return;
        }
        onJoinedCommunity(result);
        onClose();
        return;
      }

      if (modal.type === "community") {
        const name = String(data.name ?? "").trim();
        if (!name) {
          setError("copula 이름을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        await onCreateCommunity(name, String(data.description ?? ""));
        onJoinedCommunity();
        onClose();
        return;
      }

      if (modal.type === "1sUpload") {
        const fileInput = event.currentTarget.elements.namedItem("videoFile") as HTMLInputElement | null;
        const file = fileInput?.files?.[0];
        if (!file) {
          setError("비디오 파일을 선택해 주세요.");
          setIsSubmitting(false);
          return;
        }

        if (!file.type.startsWith("video/")) {
          setError("동영상 파일만 업로드할 수 있습니다.");
          setIsSubmitting(false);
          return;
        }

        if (onAddOneSecondLog && selectedCommunity) {
          await onAddOneSecondLog(selectedCommunity.id, {
            file,
            caption: String(data.caption ?? "").trim()
          });
        }
        onJoinedCommunity();
        onClose();
        return;
      }

      if (!selectedCommunity) {
        setError("copula를 먼저 선택하세요.");
        setIsSubmitting(false);
        return;
      }

      if (modal.type === "communityEdit") {
        const name = String(data.name ?? "").trim();
        if (!name) {
          setError("copula 이름을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        const formEl = event.currentTarget;
        const fileInput = formEl.elements.namedItem("coverFile") as HTMLInputElement | null;
        const coverFile = fileInput?.files?.[0] || undefined;

        await onUpdateCommunity(selectedCommunity.id, {
          name,
          description: String(data.description ?? "").trim(),
          accent: String(data.accent || selectedCommunity.accent),
          coverFile
        });
        onClose();
        return;
      }

      if (modal.type === "notice" || modal.type === "noticeEdit") {
        const title = String(data.title ?? "").trim();
        if (!title) {
          setError("공지 제목을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        const nextNotice = {
          title,
          body: String(data.body ?? "").trim(),
          pinned: data.pinned === "on"
        };
        if (modal.type === "noticeEdit") {
          if (!modal.noticeId) {
            setError("수정할 공지를 찾지 못했습니다.");
            setIsSubmitting(false);
            return;
          }
          await onUpdateNotice(selectedCommunity.id, modal.noticeId, nextNotice);
        } else {
          await onAddNotice(selectedCommunity.id, nextNotice);
        }
        onClose();
        return;
      }

      if (modal.type === "event" || modal.type === "eventEdit") {
        const title = String(data.title ?? "").trim();
        if (!title) {
          setError("일정 제목을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        const nextEvent = {
          title,
          notes: String(data.notes ?? "").trim(),
          location: String(data.location ?? "").trim(),
          startsAt: new Date(`${String(data.date)}T${String(data.time || "09:00")}:00`).toISOString()
        };
        if (modal.type === "eventEdit") {
          if (!modal.eventId) {
            setError("수정할 일정을 찾지 못했습니다.");
            setIsSubmitting(false);
            return;
          }
          await onUpdateEvent(selectedCommunity.id, modal.eventId, nextEvent);
        } else {
          await onAddEvent(selectedCommunity.id, nextEvent);
        }
        onClose();
        return;
      }

      if (modal.type === "album" || modal.type === "albumEdit") {
        const title = String(data.title ?? "").trim();
        if (!title) {
          setError("앨범 제목을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        const nextAlbum = {
          title,
          description: String(data.description ?? "").trim()
        };
        if (modal.type === "albumEdit") {
          if (!modal.albumId) {
            setError("수정할 앨범을 찾지 못했습니다.");
            setIsSubmitting(false);
            return;
          }
          await onUpdateAlbum(selectedCommunity.id, modal.albumId, nextAlbum);
        } else {
          const albumId = await onAddAlbum(selectedCommunity.id, nextAlbum);
          onAlbumCreated(albumId);
        }
        onClose();
        return;
      }

      if (modal.type === "albumItem" || modal.type === "albumItemEdit") {
        const title = String(data.title ?? "").trim();
        const albumId = String(data.albumId || modal.albumId || selectedAlbumId || "");
        const file = data.photo instanceof File && data.photo.size > 0 ? data.photo : undefined;
        if (!title) {
          setError("사진·메모 제목을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        if (!albumId) {
          setError("앨범을 먼저 선택해 주세요.");
          setIsSubmitting(false);
          return;
        }
        if (file && !file.type.startsWith("image/")) {
          setError("이미지 파일만 추가할 수 있습니다.");
          setIsSubmitting(false);
          return;
        }
        if (file && file.size > 10_000_000) {
          setError("이미지는 10MB 이하로 추가해 주세요.");
          setIsSubmitting(false);
          return;
        }
        const preparedImage = file ? await prepareImageFile(file) : undefined;
        if (modal.type === "albumItemEdit") {
          if (!modal.itemId) {
            setError("수정할 사진·메모를 찾지 못했습니다.");
            setIsSubmitting(false);
            return;
          }
          await onUpdateAlbumItem(selectedCommunity.id, albumId, modal.itemId, {
            title,
            file: preparedImage?.file,
            mediaUrl: preparedImage?.mediaUrl
          });
        } else {
          await onAddAlbumItem(selectedCommunity.id, albumId, {
            title,
            kind: preparedImage ? "photo" : "note",
            file: preparedImage?.file,
            mediaUrl: preparedImage?.mediaUrl
          });
        }
        onClose();
        return;
      }

      if (modal.type === "dday" || modal.type === "ddayEdit") {
        const title = String(data.title ?? "").trim();
        if (!title) {
          setError("D-Day 제목을 입력해 주세요.");
          setIsSubmitting(false);
          return;
        }
        const nextDDay = {
          title,
          targetDate: new Date(`${String(data.date)}T09:00:00`).toISOString(),
          kind: String(data.kind || "행사") as DDayItem["kind"],
          note: String(data.note ?? "").trim()
        };
        if (modal.type === "ddayEdit") {
          if (!modal.ddayId) {
            setError("수정할 D-Day를 찾지 못했습니다.");
            setIsSubmitting(false);
            return;
          }
          await onUpdateDDay(selectedCommunity.id, modal.ddayId, nextDDay);
        } else {
          await onAddDDay(selectedCommunity.id, nextDDay);
        }
        onClose();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "요청을 완료하지 못했습니다.");
      setIsSubmitting(false);
    }
  }

  function applyCommunityPreset(preset: (typeof communityPresets)[number]) {
    const form = formRef.current;
    if (!form) return;

    const nameInput = form.elements.namedItem("name");
    const descriptionInput = form.elements.namedItem("description");
    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = preset.name;
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (descriptionInput instanceof HTMLTextAreaElement) {
      descriptionInput.value = preset.description;
      descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  const ModalIcon = modalIcon(modal.type);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={titles[modal.type]}>
        <div className="modal-head">
          <div className="modal-title">
            <span className="modal-title-icon">
              <ModalIcon aria-hidden="true" />
            </span>
            <h2>{titles[modal.type]}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X aria-hidden="true" />
          </button>
        </div>
        <form ref={formRef} className="form-grid" onSubmit={submit} onChange={() => setError("")}>
          {renderFields(modal, selectedAlbumId, selectedCommunity, applyCommunityPreset)}
          <p className="form-error">{error}</p>
          {renderSubmitButton(modal.type, isSubmitting)}
          {modal.type === "communityEdit" && canDeleteCommunity ? (
            <button className="danger-button" type="button" onClick={onRequestDeleteCommunity}>
              <Trash2 aria-hidden="true" />
              삭제
            </button>
          ) : null}
        </form>
      </section>
    </div>
  );
}

function renderFields(
  modal: ModalState,
  selectedAlbumId: string | null,
  selectedCommunity: Community | null,
  onCommunityPreset: (preset: (typeof communityPresets)[number]) => void
) {
  if (modal.type === "join") {
    return (
      <>
        <label>
          <FieldLabel icon={KeyRound} label="초대 코드" />
          <input
            name="inviteCode"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="COPULA123"
            defaultValue={modal.inviteCode ?? ""}
            required
            autoFocus
          />
        </label>
      </>
    );
  }

  if (modal.type === "community") {
    return (
      <>
        <div className="preset-grid" aria-label="copula 프리셋">
          {communityPresets.map((preset) => (
            <button
              key={preset.label}
              className="preset-button"
              type="button"
              onClick={() => onCommunityPreset(preset)}
              title={preset.description}
            >
              <preset.icon aria-hidden="true" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
        <label>
          <FieldLabel icon={Users} label="이름" />
          <input name="name" placeholder="가족 모임" required autoFocus />
        </label>
        <label>
          <FieldLabel icon={FileText} label="설명" />
          <textarea name="description" placeholder="선택 입력" />
        </label>
      </>
    );
  }

  if (modal.type === "communityEdit") {
    return (
      <>
        <label>
          <FieldLabel icon={Users} label="이름" />
          <input name="name" placeholder="가족 모임" defaultValue={selectedCommunity?.name ?? ""} required autoFocus />
        </label>
        <label>
          <FieldLabel icon={FileText} label="설명" />
          <textarea name="description" placeholder="어떤 사람들이 함께 쓰는 공간인지 적어 주세요." defaultValue={selectedCommunity?.description ?? ""} />
        </label>
        <label>
          <FieldLabel icon={Image} label="배경 이미지 설정" />
          <input name="coverFile" type="file" accept="image/*" style={{ marginTop: "8px" }} />
          {selectedCommunity?.coverUrl ? (
            <div style={{ marginTop: "12px", position: "relative" }}>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>현재 배경 이미지:</span>
              <img
                src={selectedCommunity.coverUrl}
                alt="Community Cover"
                style={{
                  width: "100%",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "16px",
                  border: "1px solid var(--line)"
                }}
              />
            </div>
          ) : null}
        </label>
        <fieldset className="swatch-field" style={{ marginTop: "8px" }}>
          <legend><FieldLabel icon={Palette} label="색상" /></legend>
          <div className="swatch-grid">
            {accentOptions.map((accent) => (
              <label key={accent.value} className="swatch-option" title={accent.label}>
                <input
                  name="accent"
                  type="radio"
                  value={accent.value}
                  defaultChecked={(selectedCommunity?.accent ?? accentOptions[0].value) === accent.value}
                />
                <span style={{ "--swatch": accent.value } as CSSProperties} />
              </label>
            ))}
          </div>
        </fieldset>
      </>
    );
  }

  if (modal.type === "notice" || modal.type === "noticeEdit") {
    const notice = selectedCommunity?.notices.find((item) => item.id === modal.noticeId);
    return (
      <>
        <label>
          <FieldLabel icon={Megaphone} label="제목" />
          <input name="title" placeholder="이번 주 모임 안내" defaultValue={notice?.title ?? ""} required autoFocus />
        </label>
        <label>
          <FieldLabel icon={FileText} label="내용" />
          <textarea name="body" placeholder="선택 입력" defaultValue={notice?.body ?? ""} />
        </label>
        <label className="checkbox-row">
          <input name="pinned" type="checkbox" defaultChecked={notice?.pinned ?? true} />
          상단에 고정
        </label>
      </>
    );
  }

  if (modal.type === "event" || modal.type === "eventEdit") {
    const event = selectedCommunity?.events.find((item) => item.id === modal.eventId);
    const defaultDate = event ? toInputDate(event.startsAt) : modal.eventDate ?? toInputDate(addDays(1));
    return (
      <>
        <label>
          <FieldLabel icon={CalendarDays} label="제목" />
          <input name="title" placeholder="저녁 모임" defaultValue={event?.title ?? ""} required autoFocus />
        </label>
        <label>
          <FieldLabel icon={CalendarDays} label="날짜" />
          <input name="date" type="date" defaultValue={defaultDate} required />
        </label>
        <label>
          <FieldLabel icon={Clock} label="시간" />
          <input name="time" type="time" defaultValue={event ? toInputTime(event.startsAt) : "19:00"} required />
        </label>
        <label>
          <FieldLabel icon={MapPin} label="장소" />
          <input name="location" placeholder="선택 입력" defaultValue={event?.location ?? ""} />
        </label>
        <label>
          <FieldLabel icon={FileText} label="메모" />
          <textarea name="notes" placeholder="선택 입력" defaultValue={event?.notes ?? ""} />
        </label>
      </>
    );
  }

  if (modal.type === "album" || modal.type === "albumEdit") {
    const album = selectedCommunity?.albums.find((item) => item.id === modal.albumId);
    return (
      <>
        <label>
          <FieldLabel icon={Image} label="제목" />
          <input name="title" placeholder="여름 여행" defaultValue={album?.title ?? ""} required autoFocus />
        </label>
        <label>
          <FieldLabel icon={FileText} label="설명" />
          <textarea name="description" placeholder="선택 입력" defaultValue={album?.description ?? ""} />
        </label>
      </>
    );
  }

  if (modal.type === "1sUpload") {
    return (
      <>
        <label>
          <FieldLabel icon={Video} label="1초 영상" />
          <input name="videoFile" type="file" accept="video/*" required autoFocus />
        </label>
        <label>
          <FieldLabel icon={FileText} label="캡션" />
          <input name="caption" placeholder="오늘 하루는 어땠나요? (1줄 요약)" maxLength={50} />
        </label>
      </>
    );
  }

  if (modal.type === "albumItem" || modal.type === "albumItemEdit") {
    const albumId = modal.albumId || selectedAlbumId || "";
    const album = selectedCommunity?.albums.find((item) => item.id === albumId);
    const albumItem = album?.items.find((item) => item.id === modal.itemId);
    return (
      <>
        <input name="albumId" type="hidden" value={albumId} readOnly />
        <label>
          <FieldLabel icon={Image} label="제목" />
          <input name="title" placeholder="단체 사진" defaultValue={albumItem?.title ?? ""} required autoFocus />
        </label>
        <label>
          <FieldLabel icon={Upload} label={modal.type === "albumItemEdit" ? "사진 변경" : "사진"} />
          <input name="photo" type="file" accept="image/*" />
        </label>
      </>
    );
  }

  const dday = selectedCommunity?.ddays.find((item) => item.id === modal.ddayId);
  return (
    <>
      <label>
        <FieldLabel icon={Flag} label="제목" />
        <input name="title" placeholder="제주 여행" defaultValue={dday?.title ?? ""} required autoFocus />
      </label>
      <label>
        <FieldLabel icon={CalendarDays} label="날짜" />
        <input name="date" type="date" defaultValue={toInputDate(dday?.targetDate ?? addDays(7))} required />
      </label>
      <label>
        <FieldLabel icon={Sparkles} label="종류" />
        <select name="kind" defaultValue={dday?.kind ?? "행사"}>
          <option>행사</option>
          <option>기념일</option>
          <option>여행</option>
          <option>생일</option>
        </select>
      </label>
      <label>
        <FieldLabel icon={FileText} label="메모" />
        <textarea name="note" placeholder="선택 입력" defaultValue={dday?.note ?? ""} />
      </label>
    </>
  );
}

function prepareImageFile(file: File) {
  return new Promise<{ file: File; mediaUrl: string }>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("이미지를 처리하지 못했습니다."));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지를 처리하지 못했습니다."));
            return;
          }

          const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now()
          });
          resolve({
            file: resizedFile,
            mediaUrl: canvas.toDataURL("image/jpeg", 0.82)
          });
        },
        "image/jpeg",
        0.82
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽지 못했습니다."));
    };

    image.src = objectUrl;
  });
}

function toInputTime(value: string) {
  const date = new Date(value);
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${hour}:${minute}`;
}

function renderSubmitButton(type: ModalType, isSubmitting: boolean) {
  const config = {
    join: { label: "참여", icon: KeyRound },
    community: { label: "생성", icon: Plus },
    communityEdit: { label: "저장", icon: Settings },
    notice: { label: "등록", icon: Megaphone },
    noticeEdit: { label: "저장", icon: Megaphone },
    event: { label: "등록", icon: CalendarDays },
    eventEdit: { label: "저장", icon: CalendarDays },
    album: { label: "생성", icon: Image },
    albumEdit: { label: "저장", icon: Image },
    albumItem: { label: "추가", icon: Image },
    albumItemEdit: { label: "저장", icon: Image },
    dday: { label: "등록", icon: Flag },
    ddayEdit: { label: "저장", icon: Flag },
    "1sUpload": { label: "업로드", icon: Video }
  }[type];
  const Icon = config.icon;

  return (
    <button className="primary-button" type="submit" disabled={isSubmitting}>
      <Icon aria-hidden="true" />
      {isSubmitting ? "진행 중" : config.label}
    </button>
  );
}

function FieldLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="field-label">
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

function modalIcon(type: ModalType) {
  const icons: Record<ModalType, LucideIcon> = {
    join: KeyRound,
    community: Users,
    communityEdit: Settings,
    notice: Megaphone,
    noticeEdit: Megaphone,
    event: CalendarDays,
    eventEdit: CalendarDays,
    album: Image,
    albumEdit: Image,
    albumItem: Image,
    albumItemEdit: Image,
    dday: Flag,
    ddayEdit: Flag,
    "1sUpload": Video
  };
  return icons[type] ?? Sparkles;
}
