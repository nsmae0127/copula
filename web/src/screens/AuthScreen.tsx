import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type ReactNode } from "react";
import {
  FileText,
  HelpCircle,
  KeyRound,
  LogIn,
  Mail,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  X,
  type LucideIcon
} from "lucide-react";
import type { AuthCredentials, DataBackend } from "../repositories/repository";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";

type AuthPanel = "signIn" | "signUp" | "reset" | "terms" | "privacy" | "support" | null;

const legalPanels: Record<Exclude<AuthPanel, "signIn" | "signUp" | "reset" | null>, {
  title: string;
  icon: LucideIcon;
  src: string;
}> = {
  terms: { title: "이용약관", icon: FileText, src: "/legal/terms.html" },
  privacy: { title: "개인정보 처리방침", icon: ShieldCheck, src: "/legal/privacy.html" },
  support: { title: "문의", icon: HelpCircle, src: "/legal/support.html" }
};

export function AuthScreen({
  backend,
  error,
  pendingInviteCode,
  isLoading,
  onPasswordReset,
  onSignIn
}: {
  backend: DataBackend;
  error: string | null;
  pendingInviteCode?: string | null;
  isLoading: boolean;
  onPasswordReset: (email: string) => Promise<void> | void;
  onSignIn: (credentials?: AuthCredentials) => Promise<void> | void;
}) {
  const isSupabase = backend === "supabase";
  const [panel, setPanel] = useState<AuthPanel>(null);
  const [email, setEmail] = useState("");
  const [authFormKey, setAuthFormKey] = useState(0);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isLoading || isSubmitting;
  const isNotice = Boolean(error?.includes("확인 이메일"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = panel === "signUp" ? "signUp" : "signIn";
    setIsSubmitting(true);

    try {
      setNotice(null);
      if (!isSupabase) {
        await onSignIn();
        return;
      }

      await onSignIn({
        mode,
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        displayName: String(form.get("displayName") ?? "")
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetEmail = String(form.get("email") ?? email).trim();
    if (!targetEmail) {
      setNotice({ kind: "error", message: "이메일을 입력해 주세요." });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      await onPasswordReset(targetEmail);
      setNotice({ kind: "success", message: "재설정 메일을 보냈습니다." });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "메일을 보내지 못했습니다."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPanel(nextPanel: AuthPanel) {
    setNotice(null);
    if (isAuthFormPanel(nextPanel)) {
      setEmail("");
      setAuthFormKey((key) => key + 1);
    }
    setPanel(nextPanel);
  }

  function closePanel() {
    setNotice(null);
    setEmail("");
    setAuthFormKey((key) => key + 1);
    setPanel(null);
  }

  return (
    <main className="auth-screen">
      <section className="auth-minimal" aria-label="Copula">
        {isLoading ? <span className="loading-spinner" aria-label="불러오는 중" /> : null}

        <div className="auth-brand-logo" aria-label="Copula">
          <span className="auth-brand-mark">
            <img src="/assets/logo-mark-96.png" alt="" aria-hidden="true" />
          </span>
          <span className="auth-brand-name">Copula</span>
        </div>

        <div className="auth-card">
          <div className="auth-action-grid" aria-label="계정">
            {isSupabase ? (
              <>
                <button
                  type="button"
                  className="auth-luxury-button primary"
                  onClick={() => openPanel("signIn")}
                  disabled={isBusy}
                >
                  <LogIn aria-hidden="true" />
                  <span>로그인</span>
                </button>
                <button
                  type="button"
                  className="auth-luxury-button secondary"
                  onClick={() => openPanel("signUp")}
                  disabled={isBusy}
                >
                  <UserPlus aria-hidden="true" />
                  <span>회원가입</span>
                </button>
                <button
                  type="button"
                  className="auth-sub-link"
                  onClick={() => openPanel("reset")}
                  disabled={isBusy}
                >
                  비밀번호를 잊으셨나요?
                </button>
              </>
            ) : (
              <button
                type="button"
                className="auth-luxury-button primary"
                onClick={() => void onSignIn()}
                disabled={isBusy}
              >
                <Mail aria-hidden="true" />
                <span>데모 계정으로 로그인</span>
              </button>
            )}
          </div>
        </div>

        <nav className="auth-legal-text" aria-label="서비스 문서">
          <button type="button" onClick={() => openPanel("terms")}>이용약관</button>
          <button type="button" onClick={() => openPanel("privacy")}>개인정보 처리방침</button>
          <button type="button" onClick={() => openPanel("support")}>문의</button>
        </nav>
      </section>

      {panel ? (
        <AuthPopup title={panelTitle(panel)} icon={panelIcon(panel)} onClose={closePanel}>
          {panel === "signIn" || panel === "signUp" ? (
            <form
              key={`${panel}-${authFormKey}`}
              className="auth-form form-grid"
              onSubmit={submit}
              onChange={() => setNotice(null)}
            >
              {panel === "signUp" ? (
                <input name="displayName" autoComplete="name" placeholder="이름" />
              ) : null}
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="이메일"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
                autoFocus
                data-autofocus="true"
              />
              <input
                name="password"
                type="password"
                autoComplete={panel === "signUp" ? "new-password" : "current-password"}
                placeholder="비밀번호"
                minLength={6}
                required
              />
              <InlineStatus error={error} isNotice={isNotice} notice={notice} pendingInviteCode={pendingInviteCode} />
              <button className="primary-button auth-submit-button" type="submit" disabled={isBusy}>
                {panel === "signUp" ? (
                  <>
                    <UserPlus aria-hidden="true" />
                    <span>회원가입 완료</span>
                  </>
                ) : (
                  <>
                    <LogIn aria-hidden="true" />
                    <span>로그인</span>
                  </>
                )}
              </button>
            </form>
          ) : null}

          {panel === "reset" ? (
            <form
              key={`${panel}-${authFormKey}`}
              className="auth-form form-grid"
              onSubmit={requestPasswordReset}
              onChange={() => setNotice(null)}
            >
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="이메일"
                defaultValue={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
                autoFocus
                data-autofocus="true"
              />
              <InlineStatus error={null} isNotice={false} notice={notice} pendingInviteCode={null} />
              <button className="primary-button auth-submit-button" type="submit" disabled={isBusy}>
                <RotateCcw aria-hidden="true" />
                <span>비밀번호 재설정 메일 전송</span>
              </button>
            </form>
          ) : null}

          {isLegalPanel(panel) ? (
            <iframe className="legal-frame" src={legalPanels[panel].src} title={legalPanels[panel].title} />
          ) : null}
        </AuthPopup>
      ) : null}
    </main>
  );
}

function ActionButton({
  icon: Icon,
  label,
  variant = "primary",
  disabled = false,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  variant?: "primary" | "secondary" | "tertiary";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`auth-action-button is-${variant}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <Icon aria-hidden="true" className="auth-btn-icon" />
      <span className="auth-btn-label">{label}</span>
    </button>
  );
}

function AuthPopup({
  title,
  icon: Icon,
  children,
  onClose
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const viewportStyle = useVisualViewportStyle();

  useDialogFocusTrap(dialogRef, onClose);

  function keepFocusedControlVisible(event: FocusEvent<HTMLElement>) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }, 80);
    }
  }

  return (
    <div className="modal-backdrop auth-popup-backdrop" role="presentation" style={viewportStyle} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="modal auth-popup"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onFocusCapture={keepFocusedControlVisible}
      >
        <div className="modal-head">
          <div className="modal-title">
            <span className="modal-title-icon">
              <Icon aria-hidden="true" />
            </span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function InlineStatus({
  error,
  isNotice,
  notice,
  pendingInviteCode
}: {
  error: string | null;
  isNotice: boolean;
  notice: { kind: "success" | "error"; message: string } | null;
  pendingInviteCode?: string | null;
}) {
  return (
    <>
      {error ? <p className={`status-banner${isNotice ? "" : " error"}`}>{error}</p> : null}
      {notice ? (
        <p className={`status-banner${notice.kind === "error" ? " error" : ""}`}>{notice.message}</p>
      ) : null}
      {pendingInviteCode ? <p className="status-banner">{pendingInviteCode}</p> : null}
    </>
  );
}

function panelTitle(panel: AuthPanel) {
  if (panel === "signUp") return "회원가입";
  if (panel === "reset") return "비밀번호 재설정";
  if (panel && isLegalPanel(panel)) return legalPanels[panel].title;
  return "로그인";
}

function panelIcon(panel: AuthPanel): LucideIcon {
  if (panel === "signUp") return UserPlus;
  if (panel === "reset") return RotateCcw;
  if (panel && isLegalPanel(panel)) return legalPanels[panel].icon;
  return LogIn;
}

function isLegalPanel(panel: AuthPanel): panel is "terms" | "privacy" | "support" {
  return panel === "terms" || panel === "privacy" || panel === "support";
}

function isAuthFormPanel(panel: AuthPanel) {
  return panel === "signIn" || panel === "signUp" || panel === "reset";
}

type AuthViewportStyle = CSSProperties & {
  "--auth-visual-viewport-height"?: string;
  "--auth-visual-viewport-top"?: string;
};

function useVisualViewportStyle(): AuthViewportStyle {
  const [style, setStyle] = useState<AuthViewportStyle>({});

  useEffect(() => {
    function updateViewportStyle() {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? 0;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const height = viewportHeight > 120 ? viewportHeight : window.innerHeight;
      const offsetTop = viewportHeight > 120 ? viewportOffsetTop : 0;

      setStyle({
        "--auth-visual-viewport-height": `${Math.round(height)}px`,
        "--auth-visual-viewport-top": `${Math.round(offsetTop)}px`
      });
    }

    updateViewportStyle();
    window.visualViewport?.addEventListener("resize", updateViewportStyle);
    window.visualViewport?.addEventListener("scroll", updateViewportStyle);
    window.addEventListener("resize", updateViewportStyle);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportStyle);
      window.visualViewport?.removeEventListener("scroll", updateViewportStyle);
      window.removeEventListener("resize", updateViewportStyle);
    };
  }, []);

  return style;
}
