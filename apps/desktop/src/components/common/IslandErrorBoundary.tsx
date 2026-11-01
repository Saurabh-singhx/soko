import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface IslandErrorBoundaryProps {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  compact?: boolean;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface IslandErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Robust React Error Boundary tailored for the Dynamic Island HUD and Ambient Widgets.
 *
 * Prevents isolated widget failures (e.g. mascot rendering, media banner, CLI process updates)
 * from crashing the entire Dynamic Island capsule window.
 */
export class IslandErrorBoundary extends Component<IslandErrorBoundaryProps, IslandErrorBoundaryState> {
  public state: IslandErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): IslandErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentName = this.props.name || 'AnonymousComponent';
    console.error(`[IslandErrorBoundary:${componentName}] Caught rendering exception:`, error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  public handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { name, fallback, compact } = this.props;
    const { error } = this.state;
    const componentName = name || 'Widget';

    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error || new Error('Unknown error'), this.handleReset);
      }
      return fallback;
    }

    // Ultra-compact pill fallback (e.g. for small icon/mascot badges)
    if (compact) {
      return (
        <div
          title={`${componentName} crashed: ${error?.message || 'Unknown error'}. Click to retry.`}
          onClick={this.handleReset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            cursor: 'pointer',
          }}
        >
          <AlertCircle size={12} />
        </div>
      );
    }

    // Standard glass HUD card fallback
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          margin: '4px 0',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          backdropFilter: 'blur(8px)',
          color: '#fca5a5',
          fontSize: '12px',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, color: '#f87171' }} />
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 600, color: '#fff' }}>{componentName} Error: </span>
            <span style={{ opacity: 0.85 }}>{error?.message || 'Render failure'}</span>
          </div>
        </div>

        <button
          onClick={this.handleReset}
          title="Retry rendering component"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '3px 8px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '11px',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          <RotateCcw size={11} />
          <span>Retry</span>
        </button>
      </div>
    );
  }
}
