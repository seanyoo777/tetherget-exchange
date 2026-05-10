import type { LegacyRef } from "react";
import { LeverageControl } from "./LeverageControl";
import { formatTickSizeDisplay } from "../lib/trading";
import { speedFillFilterLabel, speedSortLabel } from "../lib/speedPanelLabels";
import type { MitExecMode, SpeedFillFilter, SpeedListSort, SpeedOrderPanelProps } from "../tradePanelTypes";

export function SpeedOrderPanel(props: SpeedOrderPanelProps) {
  const {
    speedDecimals,
    qtyCaption,
    qtyStep,
    applyOco,
    applyMitEnabled,
    resetSpeedView,
    highlightText,
    openVisible,
    setOpenVisible,
    mitVisible,
    setMitVisible,
    fillVisible,
    setFillVisible,
    fillsSectionRef,
    fillSearchInputRef,
    symbol,
    tickSize,
    side,
    setSide,
    orderType,
    setOrderType,
    speedPrice,
    setSpeedPrice,
    speedQty,
    setSpeedQty,
    futuresContractMode,
    allowLeverage,
    leverage,
    setLeverage,
    limitPrice,
    marketPrice,
    submitOrder,
    orderSubmitting,
    onAmendLatestSpeedOrder,
    onCancelAllSpeedOrders,
    speedPendingBookKey,
    speedMultiTicks,
    setSpeedMultiTicks,
    speedMultiCount,
    setSpeedMultiCount,
    placeSpeedMultiOrders,
    speedUseOco,
    speedTpTicks,
    speedSlTicks,
    setSpeedTpTicks,
    setSpeedSlTicks,
    speedMitEnabled,
    speedMitTrigger,
    setSpeedMitTrigger,
    speedMitOffsetTicks,
    setSpeedMitOffsetTicks,
    speedMitExecMode,
    setSpeedMitExecMode,
    registerMitOrder,
    cancelMitOrderById,
    speedMitOrders,
    speedOpenOrders,
    onAmendSpeedOrderById,
    onCancelSpeedOrderById,
    speedFills,
    speedBottomTab,
    setSpeedBottomTab,
    speedFillFilter,
    setSpeedFillFilter,
    speedOpenSort,
    setSpeedOpenSort,
    speedMitSort,
    setSpeedMitSort,
    speedFillSort,
    setSpeedFillSort,
    exportSpeedFillsCsv,
    formatKst,
    marketGroupLabel,
    speedToggleConfirm,
    setSpeedToggleConfirm,
    speedPanelTab,
    setSpeedPanelTab,
    speedSummaryCollapsed,
    setSpeedSummaryCollapsed,
    speedFillSearch,
    setSpeedFillSearch,
    speedOpenWarnThreshold,
    setSpeedOpenWarnThreshold,
    speedMitWarnThreshold,
    setSpeedMitWarnThreshold
  } = props;

  return (
    <div className="card stack speedPanel speedPanel--grid">
      <h3 className="speedSpan2">스피드 주문창</h3>
      <small className="speedSpan2">
        시장: {symbol} / Tick: {formatTickSizeDisplay(tickSize)}
      </small>
      <div className="speedTabBar speedSpan2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={speedPanelTab === "ORDER"}
          className={`speedTab ${speedPanelTab === "ORDER" ? "speedTab--active" : ""}`}
          onClick={() => setSpeedPanelTab("ORDER")}
        >
          주문
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={speedPanelTab === "AUTO"}
          className={`speedTab ${speedPanelTab === "AUTO" ? "speedTab--active" : ""}`}
          onClick={() => setSpeedPanelTab("AUTO")}
        >
          MIT·OCO
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={speedPanelTab === "STATUS"}
          className={`speedTab ${speedPanelTab === "STATUS" ? "speedTab--active" : ""}`}
          onClick={() => setSpeedPanelTab("STATUS")}
        >
          현황
        </button>
      </div>
      <div className="card speedSpan2 speedHintBar">단축키: F1 숏 · F2 롱 · Enter 주문실행</div>
      {speedPanelTab === "ORDER" ? (
        <>
          <div className="twoCol">
            <button type="button" onClick={() => setSpeedPrice(marketPrice)}>
              현
            </button>
            <button type="button" className="buyBtn" onClick={() => setOrderType("LIMIT")}>
              신
            </button>
          </div>
          <div className="twoCol">
            <button type="button" onClick={onAmendLatestSpeedOrder}>
              정
            </button>
            <button type="button" className="ghost cancelBtn" onClick={onCancelAllSpeedOrders}>
              취
            </button>
          </div>
          <div className="twoCol">
            <button
              type="button"
              className={`${side === "SHORT" ? "activeBtn" : ""} sellBtn`}
              onClick={() => setSide("SHORT")}
            >
              F1 매도(숏)
            </button>
            <button
              type="button"
              className={`${side === "LONG" ? "activeBtn" : ""} buyBtn`}
              onClick={() => setSide("LONG")}
            >
              F2 매수(롱)
            </button>
          </div>
          <div className="twoCol">
            <label>
              단가
              <input type="number" step={tickSize} value={speedPrice} onChange={(e) => setSpeedPrice(Number(e.target.value))} />
            </label>
            <label>
              {qtyCaption}
              <input
                type="number"
                step={qtyStep}
                value={speedQty}
                onChange={(e) =>
                  setSpeedQty(
                    futuresContractMode ? Math.max(1, Math.round(Number(e.target.value) || 1)) : Number(e.target.value)
                  )
                }
              />
            </label>
          </div>
          {allowLeverage ? (
            <LeverageControl
              leverage={leverage}
              setLeverage={setLeverage}
              tickSize={tickSize}
              side={side}
              orderType={orderType}
              limitPrice={limitPrice}
              marketPrice={marketPrice}
              variant="compact"
              priceBasis={speedPrice}
            />
          ) : null}
          <div className="twoCol">
            <button type="button" onClick={() => setSpeedPrice(Number((speedPrice + tickSize).toFixed(speedDecimals)))}>
              +1틱
            </button>
            <button
              type="button"
              onClick={() => setSpeedPrice(Number(Math.max(tickSize, speedPrice - tickSize).toFixed(speedDecimals)))}
            >
              -1틱
            </button>
          </div>
          <button
            type="button"
            className="speedSpan2 buyBtn"
            disabled={orderSubmitting}
            aria-busy={orderSubmitting}
            onClick={submitOrder}
          >
            {orderSubmitting ? "처리 중…" : "즉시 주문 실행"}
          </button>
        </>
      ) : null}
      {speedPanelTab === "AUTO" ? (
        <>
          <div className="twoCol">
            <label>
              다중틱간격
              <input type="number" min={1} value={speedMultiTicks} onChange={(e) => setSpeedMultiTicks(Number(e.target.value))} />
            </label>
            <label>
              다중개수
              <input type="number" min={1} max={10} value={speedMultiCount} onChange={(e) => setSpeedMultiCount(Number(e.target.value))} />
            </label>
          </div>
          <div className="twoCol">
            <button type="button" className="buyBtn" onClick={() => placeSpeedMultiOrders("LONG")}>
              다중 매수
            </button>
            <button type="button" className="ghost sellBtn" onClick={() => placeSpeedMultiOrders("SHORT")}>
              다중 매도
            </button>
          </div>
          <div className="twoCol">
            <label>
              OCO
              <select value={speedUseOco ? "ON" : "OFF"} onChange={(e) => applyOco(e.target.value === "ON")}>
                <option value="OFF">OFF</option>
                <option value="ON">ON</option>
              </select>
            </label>
            <label>
              TP틱/SL틱
              <input
                type="text"
                value={`${speedTpTicks}/${speedSlTicks}`}
                onChange={(e) => {
                  const [tp, sl] = e.target.value.split("/");
                  setSpeedTpTicks(Number(tp) || 0);
                  setSpeedSlTicks(Number(sl) || 0);
                }}
              />
            </label>
          </div>
          <div className="twoCol">
            <label>
              MIT ON/OFF
              <select value={speedMitEnabled ? "ON" : "OFF"} onChange={(e) => applyMitEnabled(e.target.value === "ON")}>
                <option value="OFF">OFF</option>
                <option value="ON">ON</option>
              </select>
            </label>
            <label>
              MIT 실행
              <select value={speedMitExecMode} onChange={(e) => setSpeedMitExecMode(e.target.value as MitExecMode)}>
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </label>
          </div>
          <div className="twoCol">
            <label>
              MIT 트리거
              <input type="number" step={tickSize} value={speedMitTrigger} onChange={(e) => setSpeedMitTrigger(Number(e.target.value))} />
            </label>
            <label>
              오프셋틱
              <input type="number" min={0} value={speedMitOffsetTicks} onChange={(e) => setSpeedMitOffsetTicks(Number(e.target.value))} />
            </label>
          </div>
          <div className="twoCol">
            <button type="button" className="buyBtn" onClick={() => registerMitOrder("LONG")}>
              MIT 매수 등록
            </button>
            <button type="button" className="ghost sellBtn" onClick={() => registerMitOrder("SHORT")}>
              MIT 매도 등록
            </button>
          </div>
          <small>MIT 대기: {speedMitOrders.length}건</small>
          <label>
            MIT 정렬
            <select value={speedMitSort} onChange={(e) => setSpeedMitSort(e.target.value as SpeedListSort)}>
              <option value="LATEST">최신순</option>
              <option value="PRICE_ASC">트리거 낮은순</option>
              <option value="PRICE_DESC">트리거 높은순</option>
            </select>
          </label>
          {speedMitOrders.length > 0 ? (
            <ul className="list">
              {speedMitOrders.slice(0, mitVisible).map((m) => (
                <li key={m.id}>
                  <div>
                    {m.side} trg:{m.trigger} off:{m.offsetTicks}t {m.execMode} qty:{m.qty}
                  </div>
                  <button type="button" className="ghost cancelBtn" onClick={() => cancelMitOrderById(m.id)}>
                    취소
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {speedMitOrders.length > mitVisible ? (
            <button type="button" className="ghost" onClick={() => setMitVisible((v) => v + 4)}>
              MIT 더보기
            </button>
          ) : null}
        </>
      ) : null}
      {speedPanelTab === "STATUS" ? (
        <>
          {speedPendingBookKey ? <small>더블클릭 대기중: {speedPendingBookKey}</small> : null}
          <div className="twoCol">
            <button type="button" className={speedBottomTab === "OPEN" ? "activeBtn" : ""} onClick={() => setSpeedBottomTab("OPEN")}>
              미체결 {speedOpenOrders.length}
            </button>
            <button type="button" className={speedBottomTab === "FILLS" ? "activeBtn" : ""} onClick={() => setSpeedBottomTab("FILLS")}>
              체결 {speedFills.length}
            </button>
          </div>
          {speedBottomTab === "OPEN" ? (
            <>
              <label>
                미체결 정렬
                <select value={speedOpenSort} onChange={(e) => setSpeedOpenSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
              <ul className="list">
                {speedOpenOrders.slice(0, openVisible).map((o) => (
                  <li key={o.id}>
                    <div>
                      {o.side} {o.qty} @ {o.price} {o.ocoRole ? `[${o.ocoRole}]` : ""}
                    </div>
                    <div className="rowActions">
                      <button type="button" className="ghost" onClick={() => onAmendSpeedOrderById(o.id, -1)}>
                        -1틱
                      </button>
                      <button type="button" className="ghost" onClick={() => onAmendSpeedOrderById(o.id, 1)}>
                        +1틱
                      </button>
                      <button type="button" className="cancelBtn" onClick={() => onCancelSpeedOrderById(o.id)}>
                        취소
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {speedOpenOrders.length > openVisible ? (
                <button type="button" className="ghost" onClick={() => setOpenVisible((v) => v + 5)}>
                  미체결 더보기
                </button>
              ) : null}
            </>
          ) : (
            <>
              <label>
                체결 필터
                <select value={speedFillFilter} onChange={(e) => setSpeedFillFilter(e.target.value as SpeedFillFilter)}>
                  <option value="ALL">전체</option>
                  <option value="MANUAL">수동</option>
                  <option value="BOOK">호가행</option>
                  <option value="MIT">MIT</option>
                  <option value="AUTO_FILL">자동체결</option>
                </select>
              </label>
              <label>
                체결 검색
                <input
                  ref={fillSearchInputRef as LegacyRef<HTMLInputElement>}
                  value={speedFillSearch}
                  onChange={(e) => setSpeedFillSearch(e.target.value)}
                  placeholder="심볼/방향/원인 ( / 단축키 )"
                />
              </label>
              <label>
                체결 정렬
                <select value={speedFillSort} onChange={(e) => setSpeedFillSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
              <button type="button" className="ghost" onClick={exportSpeedFillsCsv}>
                CSV 내보내기
              </button>
              <ul ref={fillsSectionRef as LegacyRef<HTMLUListElement>} className="list">
                {speedFills.slice(0, fillVisible).map((f) => (
                  <li key={f.id}>
                    [{marketGroupLabel}] {highlightText(f.symbol, speedFillSearch)} · {highlightText(formatKst(f.at), speedFillSearch)} KST ·{" "}
                    {highlightText(f.side, speedFillSearch)} {highlightText(String(f.qty), speedFillSearch)} @ {highlightText(String(f.price), speedFillSearch)} ·{" "}
                    <button
                      type="button"
                      className={`fillReason fillReason--${f.reason.toLowerCase()}`}
                      onClick={() => {
                        setSpeedFillFilter(f.reason);
                        setSpeedPanelTab("STATUS");
                        setSpeedBottomTab("FILLS");
                        fillsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      onDoubleClick={() => setSpeedFillFilter("ALL")}
                      title="이 원인으로 필터"
                    >
                      {highlightText(f.reason, speedFillSearch)}
                    </button>
                    {f.ocoRole ? <span> · {highlightText(f.ocoRole, speedFillSearch)}</span> : null}
                  </li>
                ))}
              </ul>
              {speedFills.length > fillVisible ? (
                <button type="button" className="ghost" onClick={() => setFillVisible((v) => v + 6)}>
                  체결 더보기
                </button>
              ) : null}
            </>
          )}
        </>
      ) : null}
      <div className="card speedSpan2 speedSummaryPanel">
        <div className="rowActions">
          <strong>요약 · 필터/정렬</strong>
          <button type="button" className="ghost" onClick={() => setSpeedSummaryCollapsed(!speedSummaryCollapsed)}>
            {speedSummaryCollapsed ? "펼치기" : "접기"}
          </button>
        </div>
        {!speedSummaryCollapsed ? (
          <>
            <small>하단탭: {speedBottomTab === "OPEN" ? "미체결" : "체결"}</small>
            <small>체결필터: {speedFillFilterLabel(speedFillFilter)}</small>
            <small>체결정렬: {speedSortLabel(speedFillSort)}</small>
            <small>미체결정렬: {speedSortLabel(speedOpenSort)}</small>
            <small>MIT정렬: {speedSortLabel(speedMitSort)}</small>
            <small>
              <span className={`kpiBadge ${speedOpenOrders.length > speedOpenWarnThreshold ? "kpiWarn" : "kpiOk"}`}>
                미체결 {speedOpenOrders.length}
              </span>{" "}
              <span className={`kpiBadge ${speedMitOrders.length > speedMitWarnThreshold ? "kpiWarn" : "kpiOk"}`}>
                MIT대기 {speedMitOrders.length}
              </span>
            </small>
            <small>
              OCO: {speedUseOco ? "ON" : "OFF"} / TP:{speedTpTicks} SL:{speedSlTicks} · MIT감시: {speedMitEnabled ? "ON" : "OFF"}
            </small>
            <div className="twoCol">
              <label>
                미체결 주의기준
                <input
                  type="number"
                  min={1}
                  value={speedOpenWarnThreshold}
                  onChange={(e) => setSpeedOpenWarnThreshold(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label>
                MIT 주의기준
                <input
                  type="number"
                  min={1}
                  value={speedMitWarnThreshold}
                  onChange={(e) => setSpeedMitWarnThreshold(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <div className="twoCol">
              <label>
                요약 필터
                <select value={speedFillFilter} onChange={(e) => setSpeedFillFilter(e.target.value as SpeedFillFilter)}>
                  <option value="ALL">전체</option>
                  <option value="MANUAL">수동</option>
                  <option value="BOOK">호가행</option>
                  <option value="MIT">MIT</option>
                  <option value="AUTO_FILL">자동체결</option>
                </select>
              </label>
              <label>
                요약 체결정렬
                <select value={speedFillSort} onChange={(e) => setSpeedFillSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
            </div>
            <div className="twoCol">
              <label>
                요약 미체결정렬
                <select value={speedOpenSort} onChange={(e) => setSpeedOpenSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
              <label>
                요약 MIT정렬
                <select value={speedMitSort} onChange={(e) => setSpeedMitSort(e.target.value as SpeedListSort)}>
                  <option value="LATEST">최신순</option>
                  <option value="PRICE_ASC">가격 낮은순</option>
                  <option value="PRICE_DESC">가격 높은순</option>
                </select>
              </label>
            </div>
            <label className="speedCheckboxRow">
              <input type="checkbox" checked={speedToggleConfirm} onChange={(e) => setSpeedToggleConfirm(e.target.checked)} />
              OCO/MIT 변경 시 확인창
            </label>
            <div className="rowActions">
              <button type="button" className={speedUseOco ? "activeBtn" : ""} onClick={() => applyOco(!speedUseOco)}>
                OCO {speedUseOco ? "끄기" : "켜기"}
              </button>
              <button type="button" className={speedMitEnabled ? "activeBtn" : ""} onClick={() => applyMitEnabled(!speedMitEnabled)}>
                MIT {speedMitEnabled ? "끄기" : "켜기"}
              </button>
            </div>
            <button type="button" className="ghost" onClick={resetSpeedView}>
              화면 필터·정렬 초기화
            </button>
          </>
        ) : (
          <small>
            하단탭:{speedBottomTab === "OPEN" ? "미체결" : "체결"} · 필터:{speedFillFilterLabel(speedFillFilter)} · 체결:{speedFills.length}건
          </small>
        )}
      </div>
    </div>
  );
}
