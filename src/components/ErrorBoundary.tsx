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
        <div style={{ padding: 24 }}>
          <h2>일시적인 UI 오류가 발생했습니다.</h2>
          <p>페이지를 새로고침해 주세요. 동일 현상은 관리자 로그에서 확인할 수 있습니다.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
