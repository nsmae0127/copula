import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function useDialogFocusTrap<T extends HTMLElement>(
  dialogRef: RefObject<T | null>,
  onClose: () => void,
  { enabled = true, restoreFocus = true }: { enabled?: boolean; restoreFocus?: boolean } = {}
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;

    const currentDialog = dialogRef.current;
    if (!currentDialog) return;
    const dialog = currentDialog;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!dialog.hasAttribute("tabindex")) {
      dialog.setAttribute("tabindex", "-1");
    }

    function focusableElements() {
      return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.visibility !== "hidden" && style.display !== "none";
      });
    }

    function focusInitialElement() {
      if (document.activeElement instanceof HTMLElement && dialog.contains(document.activeElement)) {
        return;
      }

      const elements = focusableElements();
      const preferredElement =
        elements.find((element) => element.matches("[autofocus], [data-autofocus='true']")) ?? elements[0];
      (preferredElement ?? dialog).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusableElements();
      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    const timer = window.setTimeout(focusInitialElement, 0);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (restoreFocus && previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [dialogRef, enabled, restoreFocus]);
}
