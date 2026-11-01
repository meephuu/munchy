import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DishResult } from "@/components/DishResult";

// Guest dish result. Public. `?q=` is the dish the guest typed; without it there is nothing
// to show, so go back to search. With Cache Components, reading searchParams must sit behind
// <Suspense> so the rest of the route can be prerendered.
//
// TODO: send q to the backend (POST /estimate). For now DishResult shows the design's fixture
// (pad kra pao) whatever the query is.
export default function DishPage({ searchParams }: PageProps<"/dish">) {
  return (
    <Suspense fallback={null}>
      <Dish searchParams={searchParams} />
    </Suspense>
  );
}

async function Dish({ searchParams }: Pick<PageProps<"/dish">, "searchParams">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim();
  if (!query) redirect("/");

  return <DishResult />;
}
