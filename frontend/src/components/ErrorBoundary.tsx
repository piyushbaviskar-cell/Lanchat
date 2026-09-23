import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recoveryAttempts: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    recoveryAttempts: 0
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, recoveryAttempts: 1 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[APEX SELF-HEALING ENGINE] Trapped crash:', error.message, errorInfo);
    
    // Auto-remediation: If error involves undefined state or storage, sanitize storage
    if (error.message.includes('not defined') || error.message.includes('JSON')) {
      console.warn('[Self-Healing] Detected scope/storage failure. Purging volatile cache...');
      sessionStorage.clear();
    }
  }

  private handleAutoRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleHardReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#0a0d14',
          color: '#00ff66',
          fontFamily: 'monospace',
          padding: '32px',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ff3344', marginBottom: '8px' }}>⚠️ SUBSYSTEM RUNTIME FAULT TRAPPED</h2>
          <p style={{ color: '#94a3b8', maxWidth: '600px', marginBottom: '24px' }}>
            APEX isolated a runtime fault: <code style={{ color: '#ffaa00' }}>{this.state.error?.message}</code>.
            The core thread has been shielded from a complete blackout.
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={this.handleAutoRecover}
              style={{
                background: '#00ff66',
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              RESUME APPLICATION
            </button>
            <button
              onClick={this.handleHardReset}
              style={{
                background: '#ff3344',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              PURGE & SAFE BOOT
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
