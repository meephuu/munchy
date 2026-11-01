import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DishResult } from "@/components/DishResult";
import { DishLoading, DishProblem } from "@/components/DishStates";
import { EstimateError, fetchEstimate, toView } from "@/lib/estimate";

// Guest dish result. Public. `?q=` is the dish the guest typed; it is sent to the backend
// (POST /estimate). Without it there is nothing to show, so go back to search. With Cache
// Components, reading searchParams must sit behind <Suspense> so the rest of the route can be
// prerendered; the same boundary shows the loading state while the backend works.
export default function DishPage({ searchParams }: PageProps<"/dish">) {
  return (
    <Suspense fallback={<DishLoading />}>
      <Dish searchParams={searchParams} />
    </Suspense>
  );
}

async function Dish({ searchParams }: Pick<PageProps<"/dish">, "searchParams">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim();
  if (!query) redirect("/");

  let view;
  try {
    view = toView(await fetchEstimate(query));
  } catch (e) {
    if (!(e instanceof EstimateError)) throw e;
    const title = e.kind === "unclear" ? "We couldn't read that" : "Couldn't estimate this bite";
    return <DishProblem query={query} title={title} message={e.message} />;
  }

  if (view.empty) {
    return (
      <DishProblem
        query={query}
        title="Not in our food list yet"
        message="We couldn't match anything in that to a food we know. Try a simpler name, like “fried egg” or “pad thai”."
        details={view.warnings}
      />
    );
  }

  return <DishResult query={query} view={view} />;
}
