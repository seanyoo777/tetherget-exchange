import { Component, ErrorInfo, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Keep logging simple for now; replace with remote logger later.
    console.error("UI runtime error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }} role="alert" aria-live="assertive">
          <h2>일시적인 UI 오류가 발생했습니다.</h2>
          <p>아래 버튼으로 새로고침하거나 브라우저 탭을 닫았다가 다시 여세요.</p>
          <button type="button" onClick={() => window.location.reload()}>
            페이지 새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
