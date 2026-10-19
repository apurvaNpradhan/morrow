/** Takes the first-paint splash (see index.html) off the page. */
export function removeSplash() {
  document.getElementById("splash")?.remove();
}

/**
 * Removes the splash once the router has resolved its first location, so it
 * stays up until there is something real to show, on every route.
 */
export function removeSplashOnFirstResolve(router: {
  subscribe: (event: "onResolved", fn: () => void) => () => void;
}) {
  const stop = router.subscribe("onResolved", () => {
    stop();
    removeSplash();
  });
}
