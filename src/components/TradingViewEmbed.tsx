import { useEffect, useRef } from "react";

type Props = {
  tvSymbol: string;
  /** 분 봉 간격 */
  interval?: string;
};

/**
 * TradingView Advanced Chart 위젯 (외부 스크립트).
 * https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
 */
export function TradingViewEmbed({ tvSymbol, interval = "60" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.replaceChildren();

    const outer = document.createElement("div");
    outer.className = "tradingview-widget-container";
    outer.style.height = "100%";
    outer.style.width = "100%";
    outer.style.minHeight = "380px";

    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.height = "calc(100% - 2px)";
    widgetInner.style.width = "100%";

    outer.appendChild(widgetInner);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "kr",
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
    });

    outer.appendChild(script);
    root.appendChild(outer);

    return () => {
      root.replaceChildren();
    };
  }, [tvSymbol, interval]);

  return <div ref={rootRef} className="tvEmbedRoot" />;
}
