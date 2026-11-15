import { PageNotFound } from "@/ui/PageNotFound";

/** Any address with no page of its own: every menu page is rebuilt here, so this is an old or mistyped link. */
export default function MissingPage() {
  return <PageNotFound />;
}
