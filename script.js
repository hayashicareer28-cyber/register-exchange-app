let lastCopyText = "";
const historyStorageKey = "registerExchangeHistory";

const registers = [1, 2, 3];
const coinTypes = [100, 50, 10, 5, 1];

function getCount(registerNumber, moneyType) {
  const input = document.getElementById(`r${registerNumber}-${moneyType}`);
  const value = Number(input.value);

  if (isNaN(value) || value < 0) {
    return 0;
  }

  return value;
}

function formatYen(amount) {
  return amount.toLocaleString() + "円";
}

// 外部両替の「取り出し」用。
// 取り出しはお札だけにする。
function createReturnExample(amount) {
  let remaining = amount;
  const parts = [];

  const moneyTypes = [
    { name: "10000円札", value: 10000 },
    { name: "5000円札", value: 5000 },
    { name: "1000円札", value: 1000 }
  ];

  for (const money of moneyTypes) {
    const count = Math.floor(remaining / money.value);

    if (count > 0) {
      parts.push(`${money.name}${count}枚`);
      remaining -= count * money.value;
    }
  }

  return parts.join("、");
}

// レジ間移動の「返金」用。
// レジ間の返金は小銭も使ってOK。
function createRegisterRefundExample(amount) {
  let remaining = amount;
  const parts = [];

  const moneyTypes = [
    { name: "10000円札", value: 10000 },
    { name: "5000円札", value: 5000 },
    { name: "1000円札", value: 1000 },
    { name: "500円玉", value: 500 },
    { name: "100円玉", value: 100 },
    { name: "50円玉", value: 50 },
    { name: "10円玉", value: 10 },
    { name: "5円玉", value: 5 },
    { name: "1円玉", value: 1 }
  ];

  for (const money of moneyTypes) {
    const count = Math.floor(remaining / money.value);

    if (count > 0) {
      parts.push(`${money.name}${count}枚`);
      remaining -= count * money.value;
    }
  }

  return parts.join("、");
}

function addReceiveItem(summary, name, unit, count) {
  if (count <= 0) return;

  if (!summary.receiveItems[name]) {
    summary.receiveItems[name] = { name, unit, count: 0 };
  }

  summary.receiveItems[name].count += count;
}

function createReceiveText(receiveItems) {
  const order = [
    "5000円札",
    "1000円札",
    "500円玉",
    "100円棒金",
    "50円棒金",
    "10円棒金",
    "5円棒金",
    "1円棒金"
  ];

  const parts = [];

  for (const name of order) {
    const item = receiveItems[name];

    if (item) {
      parts.push(`${item.name}${item.count}${item.unit}`);
    }
  }

  return parts.length === 0 ? "なし" : parts.join("、");
}

function getForbiddenTakeOutValues(receiveItems) {
  const forbidden = new Set();

  const valueMap = {
    "5000円札": 5000,
    "1000円札": 1000,
    "500円玉": 500,
    "100円棒金": 100,
    "50円棒金": 50,
    "10円棒金": 10,
    "5円棒金": 5,
    "1円棒金": 1
  };

  for (const name in receiveItems) {
    if (valueMap[name]) {
      forbidden.add(valueMap[name]);
    }
  }

  return forbidden;
}

function findTakeOutCombination(amount, moneyTypes, availableCounts) {
  const allowedValues = new Set(moneyTypes.map((money) => money.value));
  const available10000 = allowedValues.has(10000) ? availableCounts[10000] : 0;
  const available5000 = allowedValues.has(5000) ? availableCounts[5000] : 0;
  const available1000 = allowedValues.has(1000) ? availableCounts[1000] : 0;

  const max10000Count = Math.min(available10000, Math.floor(amount / 10000));

  for (let count10000 = max10000Count; count10000 >= 0; count10000--) {
    const after10000 = amount - count10000 * 10000;
    const count5000 = Math.min(available5000, Math.floor(after10000 / 5000));
    const after5000 = after10000 - count5000 * 5000;
    const count1000 = after5000 / 1000;

    if (Number.isInteger(count1000) && count1000 <= available1000) {
      return {
        10000: count10000,
        5000: count5000,
        1000: count1000
      };
    }
  }

  return null;
}

// 外部両替で取り出すお金を決める。
// ルール：
// 1. 取り出しに使えるのはお札だけ
// 2. 入れるものに含まれる金種は、取り出し側では使わない
function findAdjustedTakeOutAmount(baseAmount, receiveItems, availableCounts) {
  const forbidden = getForbiddenTakeOutValues(receiveItems);

  const takeOutTypes = [
    { name: "10000円札", value: 10000 },
    { name: "5000円札", value: 5000 },
    { name: "1000円札", value: 1000 }
  ].filter((money) => !forbidden.has(money.value));

  let target = Math.ceil(baseAmount / 1000) * 1000;
  const availableAmount = takeOutTypes.reduce(
    (total, money) => total + money.value * availableCounts[money.value],
    0
  );

  while (target <= availableAmount) {
    const combination = findTakeOutCombination(target, takeOutTypes, availableCounts);

    if (combination) {
      return {
        possible: true,
        amount: target,
        combination
      };
    }

    target += 1000;
  }

  return {
    possible: false,
    availableAmount
  };
}

function createTakeOutExample(combination) {
  const parts = [];

  const moneyTypes = [
    { name: "10000円札", value: 10000 },
    { name: "5000円札", value: 5000 },
    { name: "1000円札", value: 1000 }
  ];

  for (const money of moneyTypes) {
    const count = combination[money.value] || 0;
    if (count > 0) {
      parts.push(`${money.name}${count}枚`);
    }
  }

  return parts.join("、");
}

function addAdjustmentToReceive(summary, adjustmentAmount) {
  if (adjustmentAmount <= 0) return;

  if (adjustmentAmount % 1000 === 0) {
    addReceiveItem(summary, "1000円札", "枚", adjustmentAmount / 1000);
    return;
  }

  addReceiveItem(summary, "1000円札", "枚", Math.ceil(adjustmentAmount / 1000));
}

function finalizeExternalSummary(summary, registerNumber) {
  const availableCounts = {
    10000: Math.floor(getCount(registerNumber, 10000)),
    5000: Math.floor(getCount(registerNumber, 5000)),
    1000: Math.floor(getCount(registerNumber, 1000))
  };

  for (let i = 0; i < 5; i++) {
    const result = findAdjustedTakeOutAmount(
      summary.amount,
      summary.receiveItems,
      availableCounts
    );

    if (!result.possible) {
      summary.error =
        `取り出し用の紙幣が不足しています（必要：${formatYen(summary.amount)}分、` +
        `使用可能：${formatYen(result.availableAmount)}分）。`;
      return;
    }

    const adjustmentAmount = result.amount - summary.amount;

    if (adjustmentAmount === 0) {
      summary.takeOutAmount = result.amount;
      summary.takeOutExample = createTakeOutExample(result.combination);
      return;
    }

    addAdjustmentToReceive(summary, adjustmentAmount);
    summary.amount = result.amount;
  }

  const finalResult = findAdjustedTakeOutAmount(
    summary.amount,
    summary.receiveItems,
    availableCounts
  );

  if (!finalResult.possible) {
    summary.error =
      `取り出し用の紙幣が不足しています（必要：${formatYen(summary.amount)}分、` +
      `使用可能：${formatYen(finalResult.availableAmount)}分）。`;
    return;
  }

  summary.takeOutAmount = finalResult.amount;
  summary.takeOutExample = createTakeOutExample(finalResult.combination);
}

function createRegisterMoveResult() {
  const lowerLimit = 40;
  const upperLimit = 65;

  const adjustedCounts = {
    1: {},
    2: {},
    3: {}
  };

  const moveHtmlTexts = [];
  const moveCopyTexts = [];

  for (const registerNumber of registers) {
    for (const coin of coinTypes) {
      adjustedCounts[registerNumber][coin] = getCount(registerNumber, coin);
    }
  }

  for (const coin of coinTypes) {
    const surplusList = [];
    const shortageList = [];

    for (const registerNumber of registers) {
      const count = adjustedCounts[registerNumber][coin];

      if (count > upperLimit) {
        surplusList.push({
          registerNumber,
          count: count - upperLimit
        });
      }

      if (count < lowerLimit) {
        shortageList.push({
          registerNumber,
          count: lowerLimit - count
        });
      }
    }

    for (const surplus of surplusList) {
      for (const shortage of shortageList) {
        if (surplus.count <= 0 || shortage.count <= 0) continue;

        const moveCount = Math.min(surplus.count, shortage.count);
        const amount = moveCount * coin;
        const refundExample = createRegisterRefundExample(amount);

        const htmlText =
          `<article class="move-card">` +
            `<div class="move-route">` +
              `<span class="register-pill">${surplus.registerNumber}レジ</span>` +
              `<span class="route-arrow" aria-hidden="true">→</span>` +
              `<span class="register-pill">${shortage.registerNumber}レジ</span>` +
            `</div>` +
            `<p class="move-main"><strong>${coin}円玉 ${moveCount}枚</strong><span>${formatYen(amount)}分</span></p>` +
            `<p class="refund-line"><span>返金</span>${shortage.registerNumber}レジ → ${surplus.registerNumber}レジ：${refundExample}</p>` +
          `</article>`;

        const copyText =
          `${surplus.registerNumber}レジ → ${shortage.registerNumber}レジ：` +
          `${coin}円玉${moveCount}枚（${formatYen(amount)}分）\n` +
          `返金：${shortage.registerNumber}レジ → ${surplus.registerNumber}レジ：${refundExample}`;

        moveHtmlTexts.push(htmlText);
        moveCopyTexts.push(copyText);

        surplus.count -= moveCount;
        shortage.count -= moveCount;

        adjustedCounts[surplus.registerNumber][coin] -= moveCount;
        adjustedCounts[shortage.registerNumber][coin] += moveCount;
      }
    }
  }

  return {
    html: moveHtmlTexts.length === 0
      ? '<p class="empty-state">レジ間移動はありません。</p>'
      : `<div class="move-list">${moveHtmlTexts.join("")}</div>`,
    copy: moveCopyTexts.length === 0 ? "レジ間移動はありません。" : moveCopyTexts.join("\n\n"),
    adjustedCounts
  };
}

function createCoinRollExchange(coin, shortage) {
  if (coin === 100) {
    const rollCount = Math.ceil(shortage / 50);

    return {
      receiveItems: [{ name: "100円棒金", unit: "本", count: rollCount }],
      amount: rollCount * 5000
    };
  }

  if (coin === 50) {
    const rollCount = Math.ceil(shortage / 50);
    const coinAmount = rollCount * 2500;
    const add500Count = coinAmount % 1000 === 0 ? 0 : 1;

    const receiveItems = [
      { name: "50円棒金", unit: "本", count: rollCount }
    ];

    if (add500Count > 0) {
      receiveItems.push({ name: "500円玉", unit: "枚", count: add500Count });
    }

    return {
      receiveItems,
      amount: coinAmount + add500Count * 500
    };
  }

  if (coin === 10) {
    const rollCount = Math.ceil(shortage / 50);
    const coinAmount = rollCount * 500;
    const add500Count = coinAmount % 1000 === 0 ? 0 : 1;

    const receiveItems = [
      { name: "10円棒金", unit: "本", count: rollCount }
    ];

    if (add500Count > 0) {
      receiveItems.push({ name: "500円玉", unit: "枚", count: add500Count });
    }

    return {
      receiveItems,
      amount: coinAmount + add500Count * 500
    };
  }

  if (coin === 5) {
    const packageCount = Math.ceil(shortage / 100);

    return {
      receiveItems: [
        { name: "5円棒金", unit: "本", count: packageCount * 2 },
        { name: "500円玉", unit: "枚", count: packageCount }
      ],
      amount: packageCount * 1000
    };
  }

  if (coin === 1) {
    const packageCount = Math.ceil(shortage / 500);

    return {
      receiveItems: [
        { name: "1円棒金", unit: "本", count: packageCount * 10 },
        { name: "500円玉", unit: "枚", count: packageCount }
      ],
      amount: packageCount * 1000
    };
  }

  return {
    receiveItems: [],
    amount: 0
  };
}

function createExternalExchangeSummary(adjustedCounts) {
  const summaries = {
    1: { amount: 0, receiveItems: {}, takeOutAmount: 0, takeOutExample: "" },
    2: { amount: 0, receiveItems: {}, takeOutAmount: 0, takeOutExample: "" },
    3: { amount: 0, receiveItems: {}, takeOutAmount: 0, takeOutExample: "" }
  };

  const totalSummary = {
    amount: 0,
    receiveItems: {},
    takeOutAmount: 0,
    takeOutExample: "",
    failedRegisters: []
  };

  const moneyRules = [
    { moneyType: 5000, lowerLimit: 10 },
    { moneyType: 1000, lowerLimit: 38 },
    { moneyType: 500, lowerLimit: 15 }
  ];

  for (const registerNumber of registers) {
    const summary = summaries[registerNumber];

    for (const rule of moneyRules) {
      const count = getCount(registerNumber, rule.moneyType);

      if (count < rule.lowerLimit) {
        const shortage = rule.lowerLimit - count;

        if (rule.moneyType === 5000) {
          addReceiveItem(summary, "5000円札", "枚", shortage);
          summary.amount += shortage * 5000;
        }

        if (rule.moneyType === 1000) {
          addReceiveItem(summary, "1000円札", "枚", shortage);
          summary.amount += shortage * 1000;
        }

        if (rule.moneyType === 500) {
          let receiveCount = shortage;

          if (receiveCount % 2 !== 0) {
            receiveCount += 1;
          }

          addReceiveItem(summary, "500円玉", "枚", receiveCount);
          summary.amount += receiveCount * 500;
        }
      }
    }
  }

  const lowerLimit = 40;

  for (const registerNumber of registers) {
    const summary = summaries[registerNumber];

    for (const coin of coinTypes) {
      const count = adjustedCounts[registerNumber][coin];

      if (count < lowerLimit) {
        const shortage = lowerLimit - count;
        const exchange = createCoinRollExchange(coin, shortage);

        for (const item of exchange.receiveItems) {
          addReceiveItem(summary, item.name, item.unit, item.count);
        }

        summary.amount += exchange.amount;
      }
    }
  }

  for (const registerNumber of registers) {
    finalizeExternalSummary(summaries[registerNumber], registerNumber);
  }

  for (const registerNumber of registers) {
    const summary = summaries[registerNumber];

    if (summary.error) {
      totalSummary.failedRegisters.push(registerNumber);
      continue;
    }

    totalSummary.amount += summary.takeOutAmount;

    for (const key in summary.receiveItems) {
      const item = summary.receiveItems[key];
      addReceiveItem(totalSummary, item.name, item.unit, item.count);
    }
  }

  totalSummary.takeOutAmount = totalSummary.amount;

  return {
    perRegister: summaries,
    total: totalSummary
  };
}

function createExternalExchangeText(externalSummary) {
  let html = "";
  let copy = "";

  for (const registerNumber of registers) {
    const summary = externalSummary.perRegister[registerNumber];

    if (summary.error) {
      html +=
        `<article class="instruction-card instruction-card--notice">` +
          `<div class="instruction-card__header">` +
            `<h4>${registerNumber}レジ</h4>` +
            `<span class="status-badge status-badge--notice">紙幣不足</span>` +
          `</div>` +
          `<p class="notice-text">${summary.error}</p>` +
        `</article>`;
      copy += `${registerNumber}レジ：${summary.error}\n\n`;
    } else if (summary.takeOutAmount === 0) {
      html +=
        `<article class="instruction-card instruction-card--empty">` +
          `<div class="instruction-card__header">` +
            `<h4>${registerNumber}レジ</h4>` +
            `<span class="status-badge status-badge--done">作業なし</span>` +
          `</div>` +
          `<p>外部両替はありません。</p>` +
        `</article>`;
      copy += `${registerNumber}レジ：外部両替なし\n\n`;
    } else {
      const receiveText = createReceiveText(summary.receiveItems);

      html +=
        `<article class="instruction-card">` +
          `<div class="instruction-card__header">` +
            `<h4>${registerNumber}レジ</h4>` +
            `<span class="amount-badge">${formatYen(summary.takeOutAmount)}分</span>` +
          `</div>` +
          `<div class="instruction-grid">` +
            `<div class="instruction-detail instruction-detail--receive">` +
              `<span class="instruction-label">入れるもの</span>` +
              `<p>${receiveText}</p>` +
            `</div>` +
            `<div class="instruction-detail instruction-detail--takeout">` +
              `<span class="instruction-label">取り出すもの</span>` +
              `<p>${summary.takeOutExample}</p>` +
            `</div>` +
          `</div>` +
        `</article>`;

      copy += `${registerNumber}レジ：${formatYen(summary.takeOutAmount)}分取り出し\n`;
      copy += `→ 入れるもの：${receiveText}\n`;
      copy += `→ 取り出し：${summary.takeOutExample}\n\n`;
    }
  }

  return { html, copy };
}

function createExternalTotalText(externalSummary) {
  const total = externalSummary.total;
  const failedText = total.failedRegisters.length > 0
    ? `${total.failedRegisters.join("・")}レジは紙幣不足のため合計に含まれていません。`
    : "";

  if (total.takeOutAmount === 0) {
    return {
      html: failedText
        ? `<div class="total-card total-card--notice"><span>合計を作成できません</span><p>${failedText}</p></div>`
        : '<p class="empty-state">外部両替はありません。</p>',
      copy: failedText || "外部両替はありません。"
    };
  }

  const receiveText = createReceiveText(total.receiveItems);

  const html =
    `<div class="total-card">` +
      `<div class="total-amount">` +
        `<span>合計取り出し金額</span>` +
        `<strong>${formatYen(total.takeOutAmount)}分</strong>` +
      `</div>` +
      `<div class="total-needed">` +
        `<span>必要なお金</span>` +
        `<p>${receiveText}</p>` +
      `</div>` +
      (failedText ? `<p class="total-warning">※ ${failedText}</p>` : "") +
    `</div>`;

  const copy =
    `合計取り出し金額：${formatYen(total.takeOutAmount)}分\n` +
    `→ 必要なお金：${receiveText}` +
    (failedText ? `\n※ ${failedText}` : "");

  return { html, copy };
}

function calculate() {
  const moveResult = createRegisterMoveResult();
  const externalSummary = createExternalExchangeSummary(moveResult.adjustedCounts);
  const externalText = createExternalExchangeText(externalSummary);
  const externalTotalText = createExternalTotalText(externalSummary);

  const html =
    `<section class="result-section">` +
      `<div class="section-heading"><span>1</span><h3>レジ間移動</h3></div>` +
      moveResult.html +
    `</section>` +
    `<section class="result-section">` +
      `<div class="section-heading"><span>2</span><h3>外部両替・レジ別</h3></div>` +
      `<div class="instruction-list">${externalText.html}</div>` +
    `</section>` +
    `<section class="result-section result-section--total">` +
      `<div class="section-heading"><span>3</span><h3>外部両替・合計</h3></div>` +
      externalTotalText.html +
    `</section>`;

  const copy =
    "【レジ間移動】\n" +
    moveResult.copy + "\n\n" +

    "【外部両替：レジ別指示】\n" +
    externalText.copy +

    "【外部両替：合計】\n" +
    externalTotalText.copy;

  document.getElementById("result").innerHTML = html;
  document.getElementById("copyText").textContent = copy;

  lastCopyText = copy;

  let summaryLabel = "外部両替なし";

  if (externalSummary.total.takeOutAmount > 0) {
    summaryLabel = `合計 ${formatYen(externalSummary.total.takeOutAmount)}分`;
  } else if (externalSummary.total.failedRegisters.length > 0) {
    summaryLabel = "紙幣不足・確認が必要";
  }

  saveHistory(html, copy, summaryLabel);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getHistory() {
  try {
    const savedHistory = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    return Array.isArray(savedHistory) ? savedHistory : [];
  } catch (error) {
    return [];
  }
}

function setHistory(history) {
  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 20)));
    return true;
  } catch (error) {
    return false;
  }
}

function saveHistory(html, copy, summaryLabel) {
  const history = getHistory();

  history.unshift({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    summaryLabel,
    html,
    copy
  });

  setHistory(history);
  renderHistory();
}

function formatHistoryDate(createdAt) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "保存日時不明";
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  const history = getHistory();

  if (history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">保存された結果はまだありません。</p>';
    return;
  }

  historyList.innerHTML = history.map((item) => {
    const id = Number(item.id);
    const safeId = Number.isFinite(id) ? id : 0;

    return (
      `<details class="history-item">` +
        `<summary>` +
          `<span class="history-item__title">` +
            `<strong>${escapeHtml(formatHistoryDate(item.createdAt))}</strong>` +
            `<small>${escapeHtml(item.summaryLabel || "保存した両替指示")}</small>` +
          `</span>` +
        `</summary>` +
        `<div class="history-result">${item.html}</div>` +
        `<div class="history-actions">` +
          `<button type="button" onclick="restoreHistoryItem(${safeId})">この結果を表示</button>` +
          `<button type="button" class="delete-button" onclick="deleteHistoryItem(${safeId})">削除</button>` +
        `</div>` +
      `</details>`
    );
  }).join("");
}

function restoreHistoryItem(id) {
  const item = getHistory().find((historyItem) => historyItem.id === id);

  if (!item) return;

  document.getElementById("result").innerHTML = item.html;
  document.getElementById("copyText").textContent = item.copy;
  lastCopyText = item.copy;

  document.querySelector(".result-heading").scrollIntoView({ behavior: "smooth" });
}

function deleteHistoryItem(id) {
  const history = getHistory().filter((item) => item.id !== id);
  setHistory(history);
  renderHistory();
}

function clearHistory() {
  if (!confirm("保存した結果をすべて削除しますか？")) return;

  setHistory([]);
  renderHistory();
}

function copyResult() {
  if (!lastCopyText) {
    alert("先に「両替指示を作成」を押してください。");
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(lastCopyText)
      .then(function() {
        alert("コピーしました。");
      })
      .catch(function() {
        fallbackCopyText(lastCopyText);
      });
  } else {
    fallbackCopyText(lastCopyText);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
    alert("コピーしました。");
  } catch (error) {
    alert("コピーに失敗しました。コピー用テキスト欄から手動でコピーしてください。");
  }

  document.body.removeChild(textarea);
}

document.addEventListener("wheel", function() {
  if (document.activeElement.type === "number") {
    document.activeElement.blur();
  }
});

document.querySelectorAll("input[type='number']").forEach(function(input) {
  input.addEventListener("input", function() {
    if (Number(input.value) < 0) {
      input.value = 0;
    }
  });
});

renderHistory();
