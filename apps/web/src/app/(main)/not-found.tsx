import { NotFoundCard } from "@/components/not-found-card";

/**
 * A signed-in page the role can't open (page-guard `notFound()`), inside the shell like `error.tsx`: the sidebar
 * stays usable and `#content` stays the only main landmark (the root not-found.tsx brings its own <main> and a
 * full-height frame). A streamed page answers 200 with `noindex`: Next can't change the status once streaming started.
 */
export default function MainNotFound() {
  return (
    <div className="grid justify-items-center py-10">
      <NotFoundCard />
    </div>
  );
}
