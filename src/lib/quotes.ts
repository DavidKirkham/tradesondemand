import { getTrade } from "./trades";

export type Urgency = "emergency" | "routine";

export type QuotePreview = {
  urgency: Urgency;
  headline: string;
  holdLabel: string;
  holdDetail: string;
  nextStep: string;
  disclaimer: string;
};

export function getQuotePreview(tradeSlug: string, urgency: Urgency): QuotePreview {
  const trade = getTrade(tradeSlug);
  const tradeName = trade?.name ?? "this trade";

  if (urgency === "emergency") {
    return {
      urgency,
      headline: `Emergency ${tradeName.toLowerCase()} dispatch`,
      holdLabel: "$89–$149 dispatch hold",
      holdDetail:
        "When we send a tech, a dispatch hold is reserved on a card (stubbed in v1 — no real charge). That amount is credited to the job. After on-site diagnosis you approve the remaining work before it starts.",
      nextStep:
        "A dispatcher reviews your job immediately. Typical KC metro arrival is 45–90 minutes when a partner is available — we text if the window slips.",
      disclaimer:
        "After-hours and holiday holds can land at the high end. Life-threatening situations (gas leak, fire, flooding into electrical) start with 911, then call us.",
    };
  }

  return {
    urgency,
    headline: `Scheduled ${tradeName.toLowerCase()} visit`,
    holdLabel: "No trip fee to schedule",
    holdDetail:
      "Routine jobs are quoted before work starts. If parts have to be ordered, we collect a parts deposit then — not a surprise on the driveway. v1 does not process cards; this is the policy you would see in production.",
    nextStep:
      "Dispatch confirms a window (often next-day in the metro, same-week for larger scopes) and a partner reaches out with the written range.",
    disclaimer:
      "Estimates are not bids until someone sees the job. Multi-trade or restoration work may need a general contractor pass first.",
  };
}

export function quoteSummaryLine(preview: QuotePreview): string {
  return `${preview.headline} · ${preview.holdLabel}`;
}
