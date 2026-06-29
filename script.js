let lastCopyText = "";

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

function createReturnExample(amount) {
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

function canMakeAmount(amount, moneyTypes) {
  const dp = new Array(amount + 1).fill(false);
  dp[0] = true;

  for (let current = 0; current <= amount; current++) {
    if (!dp[current]) continue;

    for (const money of moneyTypes) {
      const next = current + money.value;
      if (next <= amount) {
        dp[next] = true;
      }
    }
  }

  return dp[amount];
}

function findAdjustedTakeOutAmount(baseAmount, receiveItems) {
  const forbidden = getForbiddenTakeOutValues(receiveItems);

  let takeOutTypes = [
    { name: "10000円札", value: 10000 },
    { name: "5000円札", value: 5000 },
    { name: "1000円札", value: 1000 },
    { name: "500円玉", value: 500 }
  ].filter((money) => !forbidden.has(money.value));

  if (takeOutTypes.length === 0) {
    takeOutTypes = [{ name: "10000円札", value: 10000 }];
  }

  let target = Math.ceil(baseAmount / 1000) * 1000;

  while (target <= baseAmount + 100000) {
    if (canMakeAmount(target, takeOutTypes)) {
      return {
        amount: target,
        takeOutTypes
      };
    }

    target += 1000;
  }

  return {
    amount: Math.ceil(baseAmount / 10000) * 10000,
    takeOutTypes: [{ name: "10000円札", value: 10000 }]
  };
}

function createTakeOutExampleWithAllowedTypes(amount, takeOutTypes) {
  let remaining = amount;
  const parts = [];

  const sortedTypes = [...takeOutTypes].sort((a, b) => b.value - a.value);

  for (const money of sortedTypes) {
    const count = Math.floor(remaining / money.value);

    if (count > 0) {
      parts.push(`${money.name}${count}枚`);
      remaining -= count * money.value;
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

  if (adjustmentAmount % 500 === 0) {
    addReceiveItem(summary, "500円玉", "枚", adjustmentAmount / 500);
    return;
  }

  addReceiveItem(summary, "1000円札", "枚", Math.ceil(adjustmentAmount / 1000));
}

function finalizeExternalSummary(summary) {
  for (let i = 0; i < 5; i++) {
    const result = findAdjustedTakeOutAmount(summary.amount, summary.receiveItems);
    const adjustmentAmount = result.amount - summary.amount;

    if (adjustmentAmount === 0) {
      summary.takeOutAmount = result.amount;
      summary.takeOutExample = createTakeOutExampleWithAllowedTypes(result.amount, result.takeOutTypes);
      return;
    }

    addAdjustmentToReceive(summary, adjustmentAmount);
    summary.amount = result.amount;
  }

  const finalResult = findAdjustedTakeOutAmount(summary.amount, summary.receiveItems);
  summary.takeOutAmount = finalResult.amount;
  summary.takeOutExample = createTakeOutExampleWithAllowedTypes(finalResult.amount, finalResult.takeOutTypes);
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
        const returnExample = createReturnExample(amount);

        const htmlText =
          `${surplus.registerNumber}レジ → ${shortage.registerNumber}レジ：` +
          `${coin}円玉${moveCount}枚（${formatYen(amount)}分）<br>` +
          `返金：${shortage.registerNumber}レジ → ${surplus.registerNumber}レジ：${returnExample}`;

        const copyText =
          `${surplus.registerNumber}レジ → ${shortage.registerNumber}レジ：` +
          `${coin}円玉${moveCount}枚（${formatYen(amount)}分）\n` +
          `返金：${shortage.registerNumber}レジ → ${surplus.registerNumber}レジ：${returnExample}`;

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
    html: moveHtmlTexts.length === 0 ? "レジ間移動はありません。" : moveHtmlTexts.join("<br><br>"),
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
    takeOutExample: ""
  };

  const moneyRules = [
    { moneyType: 5000, lowerLimit: 10 },
    { moneyType: 1000, lowerLimit: 38 },
    { moneyType: 500, lowerLimit: 10 }
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
    finalizeExternalSummary(summaries[registerNumber]);
  }

  for (const registerNumber of registers) {
    const summary = summaries[registerNumber];

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

    if (summary.takeOutAmount === 0) {
      html += `<strong>${registerNumber}レジ</strong>：外部両替なし<br><br>`;
      copy += `${registerNumber}レジ：外部両替なし\n\n`;
    } else {
      const receiveText = createReceiveText(summary.receiveItems);

      html += `<strong>${registerNumber}レジ</strong>：${formatYen(summary.takeOutAmount)}分取り出し<br>`;
      html += `→ 入れるもの：${receiveText}<br>`;
      html += `→ 取り出し：${summary.takeOutExample}<br><br>`;

      copy += `${registerNumber}レジ：${formatYen(summary.takeOutAmount)}分取り出し\n`;
      copy += `→ 入れるもの：${receiveText}\n`;
      copy += `→ 取り出し：${summary.takeOutExample}\n\n`;
    }
  }

  return { html, copy };
}

function createExternalTotalText(externalSummary) {
  const total = externalSummary.total;

  if (total.takeOutAmount === 0) {
    return {
      html: "外部両替はありません。",
      copy: "外部両替はありません。"
    };
  }

  const receiveText = createReceiveText(total.receiveItems);

  const html =
    `<strong>合計取り出し金額：${formatYen(total.takeOutAmount)}分</strong><br>` +
    `→ 必要なお金：${receiveText}`;

  const copy =
    `合計取り出し金額：${formatYen(total.takeOutAmount)}分\n` +
    `→ 必要なお金：${receiveText}`;

  return { html, copy };
}

function calculate() {
  const moveResult = createRegisterMoveResult();
  const externalSummary = createExternalExchangeSummary(moveResult.adjustedCounts);
  const externalText = createExternalExchangeText(externalSummary);
  const externalTotalText = createExternalTotalText(externalSummary);

  const html =
    "<div class='section-title'>レジ間移動</div>" +
    moveResult.html + "<br><br>" +

    "<div class='section-title'>外部両替：レジ別指示</div>" +
    externalText.html +

    "<div class='section-title'>外部両替：合計</div>" +
    externalTotalText.html;

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
