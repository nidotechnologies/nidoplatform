import { formatCurrency } from "@/lib/formatters";
import { getProductConfigurationEntries, type ProductConfiguration } from "@/lib/productConfiguration";

export default function ProductConfigurationSummary({
  configuration,
  priceAdjustment,
  className = "",
}: {
  configuration?: ProductConfiguration | null;
  priceAdjustment?: number;
  className?: string;
}) {
  const entries = getProductConfigurationEntries(configuration);
  const adjustment = Number(priceAdjustment || 0);
  if (entries.length === 0 && adjustment === 0) return null;

  return (
    <div className={`mt-1 space-y-0.5 text-[11px] leading-relaxed text-gray-500 ${className}`}>
      {entries.length > 0 && (
        <>
          <p className="font-medium text-gray-600">Configuration</p>
          {entries.map(([label, value], index) => (
            <p key={`${label}-${value}-${index}`}>
              <span className="font-medium text-gray-600">{label}:</span> {value}
            </p>
          ))}
        </>
      )}
      {adjustment !== 0 && (
        <p>
          <span className="font-medium text-gray-600">Option adjustment / unit:</span>{" "}
          {formatCurrency(adjustment)}
        </p>
      )}
    </div>
  );
}
