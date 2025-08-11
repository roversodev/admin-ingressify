'use client';
import { Chart01 } from "@/components/chart-01";
import { Chart02 } from "@/components/chart-02";
import { Chart03 } from "@/components/chart-03";
import { Chart04 } from "@/components/chart-04";
import { Chart05 } from "@/components/chart-05";
import { Chart06 } from "@/components/chart-06";
import Spinner from "@/components/Spinner";
import { useUser } from "@clerk/nextjs";

export default function Page() {
  const {isLoaded} = useUser();
  if (!isLoaded) {
    return <Spinner />;
  }
  return (

    <div className="grid auto-rows-min @2xl:grid-cols-2 *:-ms-px *:-mt-px -m-px">
      <Chart01 />
      <Chart02 />
      <Chart03 />
      <Chart04 />
      <Chart05 />
      <Chart06 />
    </div>
  );
}
