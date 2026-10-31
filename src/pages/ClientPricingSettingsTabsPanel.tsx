import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeClientFinalPrice,
  getAllProductPricing,
  getClientCommonSettings,
  getClientPriceSlabs,
  getRetailMarketPrices,
  resolveClientProfitPct,
  saveClientCommonSettings,
  saveClientPriceSlabs,
  saveRetailMarketPrices,
  type ClientCommonSettings,
  type PriceSlab,
} from "@/lib/priceEngineStore";
import { getClientCatalog } from "@/lib/clientCatalogStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import ClientPriceSlabsPanel from "./ClientPriceSlabsPanel";
import { toast } from "sonner";

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PricingTab = "Profit & Pricing Rules" | "Market Price Comparison" | "Slab Name";

interface MarketRow {
  code: string;
  name: string;
  category: string;
  retailPrice: number;
  vendorCost: number;
  clientPrice: number;
  profitPct: number;
  profitAmount: number;
  savingsPct: number;
  diffPct: number;
  isAboveMarket: boolean;
}

export default function ClientPricingSettingsTabsPanel({ clientId }: { clientId: string }) {
  const [activeTab, setActiveTab] = useState<PricingTab>("Profit & Pricing Rules");
  const [settings, setSettings] = useState<ClientCommonSettings>(() => getClientCommonSettings(clientId));
  const [savedSettings, setSavedSettings] = useState<ClientCommonSettings>(() => getClientCommonSettings(clientId));
  const [retailPrices, setRetailPrices] = useState<Record<string, number>>(() => getRetailMarketPrices());
  const [savedRetailPrices, setSavedRetailPrices] = useState<Record<string, number>>(() => getRetailMarketPrices());
  const [slabs, setSlabs] = useState<PriceSlab[]>(() => getClientPriceSlabs(clientId));
  const [savedSlabs, setSavedSlabs] = useState<PriceSlab[]>(() => getClientPriceSlabs(clientId));
  const [assignedProducts, setAssignedProducts] = useState<{ code: string; name: string; category: string }[]>([]);

  useEffect(() => {
    setActiveTab("Profit & Pricing Rules");
    const nextSettings = getClientCommonSettings(clientId);
    const nextRetailPrices = getRetailMarketPrices();
    const nextSlabs = getClientPriceSlabs(clientId);
    setSettings(nextSettings);
    setSavedSettings(nextSettings);
    setRetailPrices(nextRetailPrices);
    setSavedRetailPrices(nextRetailPrices);
    setSlabs(nextSlabs);
    setSavedSlabs(nextSlabs);

    const catalog = getClientCatalog(clientId);
    const masterProducts = getCatalogProducts();
    setAssignedProducts(catalog.map((entry) => {
      const product = masterProducts.find((item) => item.masterProductCode === entry.productCode);
      return {
        code: entry.productCode,
        name: product?.productName || entry.name || entry.productCode,
        category: product?.category || entry.category || "",
      };
    }));
  }, [clientId]);

  const updateField = <K extends keyof ClientCommonSettings>(
    field: K,
    value: ClientCommonSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const hasUnsavedChanges =
    JSON.stringify(settings) !== JSON.stringify(savedSettings) ||
    JSON.stringify(retailPrices) !== JSON.stringify(savedRetailPrices) ||
    JSON.stringify(slabs) !== JSON.stringify(savedSlabs);

  const saveChanges = () => {
    const slabsChanged = JSON.stringify(slabs) !== JSON.stringify(savedSlabs);
    const hasInvalidSlab = slabsChanged && slabs.some((slab) =>
      !slab.name.trim() ||
      slab.minQty < 1 ||
      slab.maxQty < slab.minQty ||
      slab.discountPct <= 0 ||
      !slab.applyTo,
    );
    if (hasInvalidSlab) {
      toast.error("Complete each price slab before saving.");
      return;
    }

    if (JSON.stringify(settings) !== JSON.stringify(savedSettings)) {
      saveClientCommonSettings(clientId, settings);
      setSavedSettings(settings);
    }
    if (JSON.stringify(retailPrices) !== JSON.stringify(savedRetailPrices)) {
      saveRetailMarketPrices(retailPrices);
      setSavedRetailPrices(retailPrices);
    }
    if (slabsChanged) {
      saveClientPriceSlabs(clientId, slabs);
      setSavedSlabs(slabs);
    }
    toast.success("Price settings saved");
  };

  const marketRows = useMemo<MarketRow[]>(() => {
    const pricingMap = new Map(getAllProductPricing().map((product) => [product.masterProductCode, product]));

    return assignedProducts.map((product) => {
      const pricing = pricingMap.get(product.code);
      const vendorCost = pricing?.landedCostPerUnit ?? 0;
      const retailPrice = retailPrices[product.code] ?? 0;
      const profitPct = resolveClientProfitPct(clientId, product.code, product.category);
      const calc = pricing?.winningVendor
        ? computeClientFinalPrice(vendorCost, settings, profitPct, product.category)
        : null;
      const clientPrice = calc?.finalPrice ?? 0;
      const profitAmount = clientPrice - vendorCost;
      const calculatedProfitPct = vendorCost > 0 ? (profitAmount / vendorCost) * 100 : 0;
      const savingsPct = retailPrice > 0 ? ((retailPrice - clientPrice) / retailPrice) * 100 : 0;
      const diffPct = retailPrice > 0 ? ((clientPrice - retailPrice) / retailPrice) * 100 : 0;

      return {
        code: product.code,
        name: product.name,
        category: product.category,
        retailPrice,
        vendorCost,
        clientPrice,
        profitPct: calculatedProfitPct,
        profitAmount,
        savingsPct,
        diffPct,
        isAboveMarket: retailPrice > 0 && clientPrice > retailPrice,
      };
    });
  }, [assignedProducts, clientId, retailPrices, settings]);

  const updateRetailPrice = (code: string, value: number) =>
    setRetailPrices((current) => ({ ...current, [code]: value }));

  return (
    <div className="space-y-4">
      <div className="flex border-b border-gray-200">
        {(["Profit & Pricing Rules", "Market Price Comparison", "Slab Name"] as PricingTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "Profit & Pricing Rules" && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">Profit &amp; Pricing Rules</h3>
          <p className="mt-1 text-[10px] text-gray-500">
            Client-specific adjustments. Global category rules are managed in Configuration → Pricing → Price Settings.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-[11px] font-medium text-gray-600">Profit Margin</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                    value={settings.profitPct || ""}
                  onChange={(event) => updateField("profitPct", Math.max(0, parseFloat(event.target.value) || 0))}
                  className="h-8 bg-white text-xs"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-medium text-gray-600">Discount</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                    value={settings.discountPct || ""}
                  onChange={(event) => updateField("discountPct", Math.min(100, Math.max(0, parseFloat(event.target.value) || 0)))}
                  className="h-8 bg-white text-xs"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-medium text-gray-600">Shipping / Delivery Fee</Label>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs text-gray-400">₹</span>
                <Input
                  type="number"
                  min={0}
                    value={settings.shippingDeliveryFee || ""}
                  onChange={(event) => updateField("shippingDeliveryFee", Math.max(0, parseFloat(event.target.value) || 0))}
                  className="h-8 bg-white text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-medium text-gray-600">Platform Fee</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                    value={settings.platformFeePct || ""}
                  onChange={(event) => updateField("platformFeePct", Math.min(100, Math.max(0, parseFloat(event.target.value) || 0)))}
                  className="h-8 bg-white text-xs"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
            <Info size={12} className="shrink-0 text-gray-400" />
            <span>
              Profit Margin is included in the Shop price. Discount, Shipping / Delivery, and Platform Fee are added separately in Cart.
            </span>
          </div>

        </div>
      )}

      {activeTab === "Market Price Comparison" && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-800">Market Price Comparison</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Set the retail market price per product and compare it with this client&apos;s calculated selling price.
            </p>
          </div>

          {assignedProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
              No products assigned to this client yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-[780px] w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Product</th>
                    <th className="w-36 px-3 py-2.5 text-left font-semibold text-gray-600">Retail Market Price</th>
                    <th className="w-28 px-3 py-2.5 text-right font-semibold text-gray-600">Vendor Cost</th>
                    <th className="w-28 px-3 py-2.5 text-right font-semibold text-gray-600">Client Price</th>
                    <th className="w-24 px-3 py-2.5 text-right font-semibold text-gray-600">vs Market</th>
                    <th className="w-24 px-3 py-2.5 text-center font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {marketRows.map((row, index) => (
                    <tr key={row.code} className={`border-b border-gray-100 last:border-0 ${index % 2 ? "bg-gray-50/30" : ""}`}>
                      <td className="px-3 py-2.5">
                        <p className="max-w-[220px] truncate font-medium text-gray-800">{row.name}</p>
                        <p className="text-[10px] text-gray-400">{row.category || row.code}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">₹</span>
                          <Input
                            type="number"
                            min={0}
                            value={row.retailPrice || ""}
                            onChange={(event) => updateRetailPrice(row.code, Math.max(0, parseFloat(event.target.value) || 0))}
                            className="h-7 w-24 bg-white text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">{row.vendorCost > 0 ? fmt(row.vendorCost) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{row.clientPrice > 0 ? fmt(row.clientPrice) : "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        {row.retailPrice > 0 ? (
                          <span className={`font-semibold ${row.diffPct <= 0 ? "text-green-700" : "text-red-600"}`}>
                            {row.diffPct > 0 ? "+" : ""}{row.diffPct.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.retailPrice === 0 ? (
                          <span className="text-[10px] text-gray-400">No price set</span>
                        ) : row.isAboveMarket ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                            <AlertTriangle size={9} /> Above
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                            <CheckCircle2 size={9} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
            <Info size={11} /> Retail market prices remain shared across clients.
          </p>
        </div>
      )}

      {activeTab === "Slab Name" && (
        <ClientPriceSlabsPanel
          clientId={clientId}
          slabs={slabs}
          onChange={setSlabs}
        />
      )}

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={saveChanges}
          disabled={!hasUnsavedChanges}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}