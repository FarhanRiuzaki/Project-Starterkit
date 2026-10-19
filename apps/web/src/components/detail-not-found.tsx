import Link from "next/link";
import { EmptyState, Panel } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { NotFoundIcon } from "@starterkit/ui/ui/icons";
import { PageHeader } from "./shell/page-header";

/**
 * The one not-found state of a detail screen (its GET answered 404: deleted, or a wrong link). No retry, since asking
 * again won't bring the record back (`retryUnlessNotFound`, `isNotFound` in lib/client/api.ts), and a way to the list.
 */
export function DetailNotFound({ title, noun, list }: { title: string; noun: string; list: { href: string; label: string } }) {
  return (
    <div className="grid gap-section">
      <PageHeader title={title} />
      <Panel>
        <EmptyState icon={NotFoundIcon} title={`This ${noun} doesn't exist`} description={`It may have been deleted. The ${list.label} page lists every ${noun} that exists.`}
          action={<Button asChild variant="secondary"><Link href={list.href}>Go to {list.label.toLowerCase()}</Link></Button>} />
      </Panel>
    </div>
  );
}
