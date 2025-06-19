import { Outlet } from 'react-router-dom'

export function Root() {
  return (
    <div>
      <h1>Claude Code SDK</h1>
      <Outlet />
    </div>
  )
}

export function ErrorBoundary({ error }: { error: Error }) {
  return <div>Oops! {error.message}</div>
}
