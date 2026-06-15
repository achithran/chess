"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/api";

interface Feature {
  name_ml: string;
  free: boolean;
  pro: boolean;
}

export default function PricingPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [monthly, setMonthly] = useState(199);

  useEffect(() => {
    api
      .pricing()
      .then((p) => {
        setFeatures(p.features);
        setMonthly(p.monthly_inr);
      })
      .catch(() => {
        // Fallback content so the page renders without the backend.
        setFeatures([
          { name_ml: "ദിവസേന വിശകലനങ്ങൾ", free: true, pro: true },
          { name_ml: "പരിധിയില്ലാത്ത വിശകലനം", free: false, pro: true },
          { name_ml: "മലയാളം AI വിശദീകരണം", free: true, pro: true },
          { name_ml: "വോയ്സ് വിശദീകരണം", free: false, pro: true },
          { name_ml: "ഓപ്പണിംഗ് കോഴ്സുകൾ", free: false, pro: true },
        ]);
      });
  }, []);

  return (
    <div className="container-px py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">പ്ലാനുകൾ</h1>
        <p className="mt-3 font-ml text-gray-400">
          സൗജന്യമായി തുടങ്ങൂ. തയ്യാറാകുമ്പോൾ Pro-യിലേക്ക് അപ്ഗ്രേഡ് ചെയ്യൂ.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {/* Free */}
        <div className="card">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="mt-2 text-3xl font-bold">
            ₹0<span className="text-base font-normal text-gray-400">/മാസം</span>
          </p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f.name_ml} className="flex items-center gap-2 font-ml text-sm">
                {f.free ? (
                  <Check className="h-4 w-4 text-brand" />
                ) : (
                  <X className="h-4 w-4 text-gray-600" />
                )}
                <span className={f.free ? "text-gray-200" : "text-gray-500"}>
                  {f.name_ml}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn-ghost mt-8 w-full">സൗജന്യമായി തുടങ്ങൂ</button>
        </div>

        {/* Pro */}
        <div className="card relative border-brand">
          <span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white">
            ജനപ്രിയം
          </span>
          <h2 className="text-xl font-semibold text-brand">Pro</h2>
          <p className="mt-2 text-3xl font-bold">
            ₹{monthly}
            <span className="text-base font-normal text-gray-400">/മാസം</span>
          </p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f.name_ml} className="flex items-center gap-2 font-ml text-sm">
                <Check className="h-4 w-4 text-brand" />
                <span className="text-gray-200">{f.name_ml}</span>
              </li>
            ))}
          </ul>
          <button className="btn-primary mt-8 w-full">Pro-യിലേക്ക് അപ്ഗ്രേഡ്</button>
        </div>
      </div>
    </div>
  );
}
