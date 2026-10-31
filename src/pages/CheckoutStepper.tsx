import { Check } from "lucide-react";

const STEPS = ["Delivery Details", "Payment Method", "Review & Place Order"];

export default function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((label, idx) => {
        const step = idx + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 shrink-0 transition-colors ${
                  done
                    ? "bg-blue-600 border-blue-600 text-white"
                    : active
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {done ? <Check size={15} strokeWidth={2.5} /> : step}
              </div>
              <span
                className={`text-sm font-medium ${
                  active ? "text-gray-900" : done ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {step < 3 && (
              <div
                className={`flex-1 h-0.5 mx-4 ${
                  done ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
