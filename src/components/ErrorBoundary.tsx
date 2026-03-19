import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  name?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}]`, error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="gs-error-boundary">
          <div className="gs-error-boundary__card">
            <span className="gs-error-boundary__icon">⚠️</span>
            <strong className="gs-error-boundary__title">
              {this.props.name ?? 'Component'} Error
            </strong>
            <p className="gs-error-boundary__message">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              className="gs-error-boundary__retry gs-button primary"
              onClick={this.handleRetry}
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
