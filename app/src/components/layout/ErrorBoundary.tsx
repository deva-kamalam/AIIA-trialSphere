import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon } from 'lucide-react'

interface State { error: Error | null }

/** Keeps a failure in one page from blanking the whole app. Reset by changing `key` (e.g. on navigation). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page failed to render', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-panel)] border border-line bg-white px-6 py-10 text-center" role="alert">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-crit-soft">
          <AlertOctagon className="size-5 text-crit" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-ink">This page couldn't be displayed</h1>
        <p className="mt-2 text-sm text-muted">
          Something went wrong while loading it. Your saved data is not affected. Reload the page, or go to another module from the sidebar.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-9 items-center rounded-[var(--radius-ctl)] bg-ink px-3.5 text-sm font-medium text-white hover:bg-ink-2"
        >
          Reload page
        </button>
      </div>
    )
  }
}
