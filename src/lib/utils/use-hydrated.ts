import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false during SSR / before hydration. Auth forms keep submit disabled until then, so an early click can't do a native GET with the password in the URL. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
