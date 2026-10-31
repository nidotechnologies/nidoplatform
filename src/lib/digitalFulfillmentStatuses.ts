const DIGITAL_FULFILLMENT_STAGES = [
  "Pending",
  "Processing",
  "Provisioning",
  "Partially Provisioned",
  "Provisioned",
  "Activated",
  "Completed",
];

/** Digital fulfillment has its own stages; quantities are recorded from actual work, never estimated. */
export function getDigitalFulfillmentStatusSequence(_quantity?: number | string): string[] {
  return [...DIGITAL_FULFILLMENT_STAGES];
}

/** Format a partial milestone only when the operator supplies an actual completed count. */
export function formatPartiallyProvisionedStatus(
  completedQuantity: number,
  totalQuantity: number,
): string | null {
  if (
    !Number.isInteger(completedQuantity)
    || !Number.isInteger(totalQuantity)
    || totalQuantity < 2
    || completedQuantity < 1
    || completedQuantity >= totalQuantity
  ) {
    return null;
  }
  return `Partially Provisioned (${completedQuantity}/${totalQuantity})`;
}

export function deriveDigitalFulfillmentStatus(
  lines: Array<{ status: string; quantity: number | string }>,
): string {
  if (lines.length === 0) return "Pending";

  const records = lines.map((line) => {
    const quantity = Number(line.quantity);
    const total = Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 0;
    const status = String(line.status || "Pending").trim();
    const index = getDigitalFulfillmentStatusIndex(status);
    const stage = index >= 0
      ? DIGITAL_FULFILLMENT_STAGES[index]
      : status.replace(/\s+\([^)]*\)$/, "");
    const partial = status.match(/^Partially Provisioned\s*\((\d+)\/(\d+)\)$/i);
    const provisioned = partial && Number(partial[2]) === total
      ? Number(partial[1])
      : index >= 4
        ? total
        : index === 3
          ? null
          : 0;
    return { stage, index, total, provisioned };
  });

  if (records.every((record) => record.index >= 6)) return "Completed";
  if (records.every((record) => record.index >= 5)) return "Activated";
  if (records.every((record) => record.index >= 4)) return "Provisioned";

  const totalQuantity = records.reduce((sum, record) => sum + record.total, 0);
  const countsKnown = records.every((record) => record.provisioned !== null);
  const provisionedQuantity = records.reduce(
    (sum, record) => sum + (record.provisioned ?? 0),
    0,
  );
  if (!countsKnown) return "Partially Provisioned";
  if (provisionedQuantity > 0 && provisionedQuantity < totalQuantity) {
    return "Partially Provisioned";
  }
  if (totalQuantity > 0 && provisionedQuantity >= totalQuantity) return "Provisioned";

  if (records.every((record) => record.stage === records[0].stage)) return records[0].stage;
  if (records.some((record) => record.index >= 2)) return "Provisioning";
  if (records.some((record) => record.index >= 1)) return "Processing";
  return "Pending";
}

/** Finds a digital stage even if its saved count label predates a quantity edit. */
export function getDigitalFulfillmentStatusIndex(
  status: string,
  quantity?: number | string,
): number {
  const sequence = getDigitalFulfillmentStatusSequence(quantity);
  const normalizedStatus = String(status || "").trim();
  if (normalizedStatus.toLowerCase() === "confirmed") {
    return sequence.indexOf("Processing");
  }

  const stage = normalizedStatus.replace(/\s+\([^)]*\)$/, "");
  return sequence.findIndex((option) => option === stage);
}