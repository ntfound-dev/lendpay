import type { ErrorInfo, ReactNode } from 'react'
import React from 'react'
import { Button } from '../ui/Button'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React error', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="error-screen" role="alert">
        <div className="error-screen__card">
          <span className="error-screen__eyebrow">Application recovery</span>
          <h1 className="error-screen__title">Something went wrong while loading LendPay.</h1>
          <p className="error-screen__copy">
            The page hit an unexpected error. Retry to re-mount the app without losing the browser tab.
          </p>
          <Button onClick={this.handleRetry}>Retry app</Button>
        </div>
      </div>
    )
  }
}
