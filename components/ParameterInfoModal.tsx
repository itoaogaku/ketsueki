"use client";

import { useEffect } from "react";
import { PARAMETER_INFO } from "@/lib/parameter-info";

/** Popup explaining what a blood-test parameter measures and why a
 * distance runner should care about it, opened by tapping the parameter
 * name in a wide table. Closes on Escape, backdrop click, or the close
 * button. */
export function ParameterInfoModal({
  parameter,
  onClose,
}: {
  parameter: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = PARAMETER_INFO[parameter];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(11, 11, 11, 0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parameter-info-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg p-5"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3
            id="parameter-info-title"
            className="text-base font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {parameter}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-2 py-1 text-xs"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            閉じる
          </button>
        </div>

        {!info ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            この項目の解説はまだ用意されていません。
          </p>
        ) : (
          <div className="mt-3 space-y-4 text-sm" style={{ color: "var(--text-primary)" }}>
            <section className="space-y-1">
              <h4 className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                何を測っているか
              </h4>
              <p className="leading-relaxed">{info.whatItMeasures}</p>
            </section>
            <section className="space-y-1">
              <h4 className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                長距離ランナーにとっての意味
              </h4>
              <p className="leading-relaxed">{info.athleteRelevance}</p>
            </section>
            <section className="space-y-1">
              <h4 className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                参考文献
              </h4>
              <ul className="space-y-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {info.references.map((ref, i) => (
                  <li key={i}>・{ref}</li>
                ))}
              </ul>
            </section>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              ※ここでの説明は一般的な情報提供を目的としたものであり、診断ではありません。継続的な異常値は必ずチームドクターにご相談ください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
