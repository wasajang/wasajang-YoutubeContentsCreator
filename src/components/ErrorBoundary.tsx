/**
 * Error Boundary 컴포넌트
 *
 * React 런타임 에러 발생 시 앱 전체 크래시를 방지하고
 * 사용자에게 복구 가능한 에러 화면을 보여줍니다.
 */
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** 에러 발생 시 보여줄 fallback (선택) */
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] 에러 발생:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="error-boundary">
                    <div className="error-boundary__card">
                        <div className="error-boundary__icon">
                            <AlertTriangle size={48} />
                        </div>
                        <h2 className="error-boundary__title">문제가 발생했습니다</h2>
                        <p className="error-boundary__message">
                            예상치 못한 에러가 발생했습니다.
                            <br />
                            아래 버튼으로 복구를 시도해보세요.
                        </p>
                        {this.state.error && (
                            <details className="error-boundary__details">
                                <summary>에러 상세 정보</summary>
                                <pre>{this.state.error.message}</pre>
                                {this.state.errorInfo && (
                                    <pre className="error-boundary__stack">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </details>
                        )}
                        <div className="error-boundary__actions">
                            <button className="btn-primary" onClick={this.handleReset}>
                                <RefreshCw size={14} /> 다시 시도
                            </button>
                            <button className="btn-secondary" onClick={this.handleGoHome}>
                                <Home size={14} /> 홈으로 이동
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
