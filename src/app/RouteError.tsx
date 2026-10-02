import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Last-resort screen for errors thrown while rendering a route. */
export function RouteError() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <main className="app-main">
      <div className="error-panel" role="alert">
        <h1>Something went wrong</h1>
        <p>
          DailyOS hit an unexpected error while showing this screen. Your saved data is not affected
          by a display error.
        </p>
        <p>
          <code>{detail}</code>
        </p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            window.location.assign('/');
          }}
        >
          Return to Today
        </button>
      </div>
    </main>
  );
}
