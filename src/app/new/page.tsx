import { Suspense } from "react";
import NewKit from "./NewKit";

export const metadata = { title: "New Memory Kit · Familiar" };

export default function Page() {
  return (
    <Suspense>
      <NewKit />
    </Suspense>
  );
}
