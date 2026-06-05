import { KeyRound, RefreshCw, Save, ChevronRight, LogOut } from "lucide-react";
import { useState, type CSSProperties, type FormEvent } from "react";
import type { CopulaState } from "../types";
import type { DataBackend } from "../repositories/repository";

interface ProfileScreenProps {
  state: CopulaState;
  backend: DataBackend;
  isPasswordResetIntent: boolean;
  onResetDemo: () => void;
  onUpdateProfile: (input: { name: string; handle: string }) => Promise<void> | void;
  onUpdatePassword: (password: string) => Promise<void> | void;
  onSignOut: () => void;
}

export function ProfileScreen({
  state,
  backend,
  isPasswordResetIntent,
  onResetDemo,
  onUpdateProfile,
  onUpdatePassword,
  onSignOut
}: ProfileScreenProps) {
  const user = state.currentUser;
  const [status, setStatus] = useState<{ kind: "idle" | "success" | "error"; message: string }>({
    kind: "idle",
    message: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ kind: "idle" | "success" | "error"; message: string }>({
    kind: "idle",
    message: ""
  });
  const [showPasswordResetHint, setShowPasswordResetHint] = useState(isPasswordResetIntent);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setStatus({ kind: "idle", message: "" });

    try {
      await onUpdateProfile({
        name: String(form.get("name") ?? ""),
        handle: String(form.get("handle") ?? "")
      });
      setStatus({ kind: "success", message: "프로필을 저장했습니다." });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "프로필을 저장하지 못했습니다."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");
    setIsPasswordSaving(true);
    setPasswordStatus({ kind: "idle", message: "" });

    try {
      if (password !== passwordConfirm) {
        throw new Error("비밀번호 확인이 일치하지 않습니다.");
      }
      await onUpdatePassword(password);
      event.currentTarget.reset();
      setShowPasswordResetHint(false);
      setPasswordStatus({ kind: "success", message: "비밀번호를 변경했습니다." });
    } catch (error) {
      setPasswordStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "비밀번호를 변경하지 못했습니다."
      });
    } finally {
      setIsPasswordSaving(false);
    }
  }

  return (
    <div className="profile-container">
      <section className="page-head">
        <span className="eyebrow">계정 설정</span>
        <h1>계정</h1>
      </section>

      {user && (
        <div className="profile-avatar-hero">
          <span className="avatar hero-avatar" style={{ "--accent": "var(--primary)" } as CSSProperties}>
            {user.initials}
          </span>
          <h2 className="hero-name">{user.name}</h2>
          <span className="hero-handle">{user.handle}</span>
        </div>
      )}

      {user ? (
        <form className="settings-section" onSubmit={submitProfile}>
          <h3 className="settings-group-title">개인 정보</h3>
          <div className="settings-group">
            <div className="settings-row">
              <span className="settings-row-label">이름</span>
              <input name="name" defaultValue={user.name} required placeholder="이름을 입력하세요" />
            </div>
            <div className="settings-row">
              <span className="settings-row-label">사용자 아이디</span>
              <input
                name="handle"
                defaultValue={user.handle}
                autoComplete="username"
                autoCapitalize="none"
                pattern="@?[A-Za-z0-9_]{2,30}"
                required
                placeholder="@username"
              />
            </div>
            <button className="settings-row-btn" type="submit" disabled={isSaving}>
              <Save size={16} />
              <span>{isSaving ? "저장 중..." : "변경 사항 저장"}</span>
            </button>
          </div>
          {status.message && (
            <p className={`status-banner ${status.kind === "error" ? "error" : "success"}`} style={{ margin: "-10px 0 15px 0" }}>
              {status.message}
            </p>
          )}
        </form>
      ) : null}

      <div className="settings-section">
        <h3 className="settings-group-title">서비스 현황</h3>
        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">참여 copula</span>
            <span className="settings-row-value">{state.communities.length}개</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">참여 방식</span>
            <span className="settings-row-value">초대 코드</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">데이터 저장</span>
            <span className="settings-row-value">{backend === "supabase" ? "클라우드" : "이 기기"}</span>
          </div>
        </div>
      </div>

      {backend === "supabase" ? (
        <form className="settings-section" onSubmit={submitPassword}>
          <h3 className="settings-group-title">보안 및 로그인</h3>
          <div className="settings-group">
            {showPasswordResetHint && (
              <div className="settings-row" style={{ background: "rgba(240, 113, 122, 0.07)" }}>
                <span className="settings-row-value" style={{ width: "100%", textAlign: "left", fontSize: "0.85rem", color: "var(--primary-ink)" }}>
                  재설정을 완료하려면 새 비밀번호를 저장해 주세요.
                </span>
              </div>
            )}
            <div className="settings-row">
              <span className="settings-row-label">새 비밀번호</span>
              <input name="password" type="password" autoComplete="new-password" minLength={6} required placeholder="최소 6자리" />
            </div>
            <div className="settings-row">
              <span className="settings-row-label">비밀번호 확인</span>
              <input name="passwordConfirm" type="password" autoComplete="new-password" minLength={6} required placeholder="다시 입력" />
            </div>
            <button className="settings-row-btn" type="submit" disabled={isPasswordSaving}>
              <KeyRound size={16} />
              <span>{isPasswordSaving ? "변경 중..." : "비밀번호 변경"}</span>
            </button>
          </div>
          {passwordStatus.message && (
            <p className={`status-banner ${passwordStatus.kind === "error" ? "error" : "success"}`} style={{ margin: "-10px 0 15px 0" }}>
              {passwordStatus.message}
            </p>
          )}
        </form>
      ) : null}

      <div className="settings-section">
        <h3 className="settings-group-title">시스템 관리</h3>
        <div className="settings-group">
          <button className="settings-row-btn" type="button" onClick={onResetDemo} style={{ color: "var(--text-ink)" }}>
            <RefreshCw size={16} />
            <span>{backend === "supabase" ? "데이터 다시 불러오기" : "초기 상태로 복원"}</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-group-title">이용 안내</h3>
        <div className="settings-group">
          <a href="/legal/terms.html" target="_blank" rel="noreferrer" className="settings-row settings-row-link">
            <span className="settings-row-label">이용약관</span>
            <ChevronRight size={16} className="chevron-icon" />
          </a>
          <a href="/legal/privacy.html" target="_blank" rel="noreferrer" className="settings-row settings-row-link">
            <span className="settings-row-label">개인정보 처리방침</span>
            <ChevronRight size={16} className="chevron-icon" />
          </a>
          <a href="/legal/support.html" target="_blank" rel="noreferrer" className="settings-row settings-row-link">
            <span className="settings-row-label">문의 및 탈퇴 안내</span>
            <ChevronRight size={16} className="chevron-icon" />
          </a>
        </div>
      </div>

      <div className="settings-section" style={{ marginTop: "32px", marginBottom: "40px" }}>
        <div className="settings-group">
          <button className="settings-row-btn danger" type="button" onClick={onSignOut}>
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
}
