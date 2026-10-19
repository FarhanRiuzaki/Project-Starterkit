import { PageTransition } from "@starterkit/ui/motion";

/**
 * Re-created by Next on every route-segment change (not on search-param changes): the CSS page enter, until the
 * layout's PageTransitionRoot takes over with the Framer crossfade.
 */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
