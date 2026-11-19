import { css, keyframes } from "@emotion/react";
import { createContext, type ComponentChildren } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { Icon } from "@components/Icon";
import { theme } from "@constants";

export type ToastVariant = "info" | "success" | "error";

export type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
};

export type ToastContextValue = {
  toast: ToastMessage | null;
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: () => void;
};

const noopToast: ToastContextValue = {
  toast: null,
  showToast: () => undefined,
  dismissToast: () => undefined,
};

export const ToastContext = createContext<ToastContextValue>(noopToast);

export const ToastProvider = ({
  children,
}: {
  children: ComponentChildren;
}) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | null>(null);
  const counterRef = useRef(0);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      const id = ++counterRef.current;
      setToast({ id, message, variant });
      timerRef.current = window.setTimeout(() => {
        setToast(prev => (prev?.id === id ? null : prev));
      }, 2600);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({ toast, showToast, dismissToast }),
    [toast, showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const slideFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
`;

const styles = {
  banner: css({
    position: "absolute",
    left: "50%",
    bottom: "68px",
    transform: "translateX(-50%)",
    zIndex: 60,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    maxWidth: "calc(100% - 32px)",
    padding: "8px 14px",
    borderRadius: "20px",
    backgroundColor: theme.colors.dialog,
    color: theme.colors.onDialog,
    border: `1px solid ${theme.colors.onDialogDivider}`,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
    fontSize: "13px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    animation: `${slideFadeIn} 0.18s ease-out`,
  }),
  bannerFixed: css({
    position: "fixed",
    bottom: "24px",
  }),
  bannerError: css({
    borderColor: "var(--error-color, #db4437)",
  }),
  bannerSuccess: css({
    borderColor: "var(--success-color, #43a047)",
  }),
};

export const ToastBanner = ({ fixed = false }: { fixed?: boolean }) => {
  const { toast } = useToast();
  if (!toast) return null;

  const icon =
    toast.variant === "error"
      ? "mdi:alert-circle-outline"
      : toast.variant === "success"
        ? "mdi:check-circle-outline"
        : "mdi:information-outline";

  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      css={[
        styles.banner,
        fixed && styles.bannerFixed,
        toast.variant === "error" && styles.bannerError,
        toast.variant === "success" && styles.bannerSuccess,
      ]}
    >
      <Icon icon={icon} size="x-small" />
      <span>{toast.message}</span>
    </div>
  );
};
