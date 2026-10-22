/**
 * HomePage — Server Component
 *
 * Thin RSC shell that renders the interactive AuditWorkspace client
 * component. Keeping the page itself as a Server Component allows
 * Next.js App Router to stream static layout chrome (header, metadata)
 * without waiting for the client JS bundle to hydrate, and keeps the
 * client bundle smaller by not pulling all interactive logic into the
 * page module.
 */
import { AuditWorkspace } from "@/components/AuditWorkspace";

export default function HomePage() {
  return <AuditWorkspace />;
}
