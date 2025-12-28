import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {}

function TradingViewWidget({}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": "CME_MINI:NQ1!",
      "interval": "D",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "backgroundColor": "rgba(19, 23, 34, 1)",
      "gridColor": "rgba(42, 46, 57, 0.06)",
      "allow_symbol_change": true,
      "calendar": false,
      "support_host": "https://www.tradingview.com"
    });

    if (container.current) {
      container.current.innerHTML = '';
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container__widget';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';
      container.current.appendChild(widgetContainer);
      container.current.appendChild(script);
    }

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div 
      className="tradingview-widget-container" 
      ref={container} 
      style={{
        height: "calc(100vh - 64px)",
        width: "100%",
        position: "relative",
        backgroundColor: "#131722"
      }}
    >
      <div className="tradingview-widget-copyright" style={{ position: "absolute", bottom: "5px", left: "5px", zIndex: 1 }}>
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          <span className="blue-text">Track all markets on TradingView</span>
        </a>
      </div>
    </div>
  );
}

export default TradingViewWidget; 