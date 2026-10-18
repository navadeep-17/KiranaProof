import type { Metadata } from "next";
import { DeliveryWorkbench } from "@/components/delivery/delivery-workbench";

export const metadata: Metadata = {
  title: "New delivery | KiranaProof",
  description: "Compare a complete invoice with its received items.",
};

export default function NewDelivery() {
  return <DeliveryWorkbench />;
}
