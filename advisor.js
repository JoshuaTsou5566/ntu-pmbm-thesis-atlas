const DATA_URL = "../data/theses.json";

const safeText = (value) => (value || "").trim();

const shortText = (value, limit = 260) => {
  const text = safeText(value).replace(/\s+/g, " ");
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}...`;
};

const slugify = (value) =>
  safeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const extractAdvisor = (item) => {
  const rawZh = safeText(item.advisor_zh);
  const rawEn = safeText(item.advisor_en);
  const zhLine =
    rawZh
      .split(/\n+/)
      .map((part) => part.trim())
      .find((part) => /[\u4e00-\u9fff]/.test(part)) || rawZh || "未載明";
  const englishLine =
    rawEn ||
    rawZh
      .split(/\n+/)
      .map((part) => part.trim())
      .find((part) => part && !/[\u4e00-\u9fff]/.test(part)) ||
    "";

  return {
    name: zhLine || "未載明",
    english: englishLine,
    slug: slugify(zhLine || "undisclosed"),
  };
};

const nodes = {
  title: document.querySelector("#advisor-name"),
  english: document.querySelector("#advisor-english"),
  total: document.querySelector("#advisor-total"),
  years: document.querySelector("#advisor-years"),
  themeCount: document.querySelector("#advisor-theme-count"),
  keywords: document.querySelector("#advisor-keywords"),
  timeline: document.querySelector("#advisor-timeline"),
  themeChart: document.querySelector("#advisor-theme-chart"),
  list: document.querySelector("#advisor-thesis-list"),
};

const renderBarChart = (container, entries) => {
  container.replaceChildren();
  const max = Math.max(...entries.map(([, value]) => value), 1);
  entries.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-label">${label}</div>
      <div class="chart-track"><div class="chart-bar" style="width:${(value / max) * 100}%"></div></div>
      <div class="chart-value">${value}</div>
    `;
    container.appendChild(row);
  });
};

const renderTheses = (items) => {
  nodes.list.replaceChildren();
  items
    .sort((a, b) => Number(a.year) - Number(b.year) || a.title_zh.localeCompare(b.title_zh, "zh-Hant"))
    .forEach((item) => {
      const card = document.createElement("article");
      card.className = "thesis-card";
      card.innerHTML = `
        <div class="card-topline">
          <span class="year-chip">${item.year}</span>
          <span class="theme-chip">${item.theme_primary || "未分類"}</span>
        </div>
        <h3 class="thesis-title">${item.title_zh || "未命名論文"}</h3>
        <p class="thesis-title-en">${item.title_en || ""}</p>
        <p class="keywords"><strong>關鍵字</strong> ${item.keywords_zh || "無"}</p>
        <div class="abstract-block">
          <h4 class="abstract-heading">中文摘要</h4>
          <p class="abstract">${shortText(item.abstract_zh || item.abstract_en, 420)}</p>
        </div>
        <div class="card-footer">
          <a class="advisor-page-link" href="../index.html?advisor=${encodeURIComponent(item.advisor_name || "")}">回首頁篩選</a>
          <a class="detail-link" target="_blank" rel="noreferrer" href="${item.url}">開啟論文頁面</a>
        </div>
      `;
      nodes.list.appendChild(card);
    });
};

const init = async () => {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`資料載入失敗：${response.status}`);
  }

  const rows = (await response.json()).map((item) => {
    const advisor = extractAdvisor(item);
    return {
      ...item,
      advisor_name: advisor.name,
      advisor_english: advisor.english,
      advisor_slug: advisor.slug,
    };
  });

  const advisorSlug = window.__ADVISOR_SLUG__;
  const theses = rows.filter((item) => item.advisor_slug === advisorSlug);
  if (theses.length === 0) {
    throw new Error("找不到這位指導教授的資料。");
  }

  const profile = theses[0];
  const themeCounts = Object.entries(
    theses.reduce((acc, item) => {
      acc[item.theme_primary] = (acc[item.theme_primary] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const yearCounts = Object.entries(
    theses.reduce((acc, item) => {
      acc[item.year] = (acc[item.year] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => Number(a[0]) - Number(b[0]));

  const keywordCounts = Object.entries(
    theses.reduce((acc, item) => {
      safeText(item.keywords_zh)
        .split("；")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .forEach((keyword) => {
          acc[keyword] = (acc[keyword] || 0) + 1;
        });
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  document.title = `${profile.advisor_name}｜NTU 生技管理論文地圖`;
  nodes.title.textContent = profile.advisor_name;
  nodes.english.textContent = profile.advisor_english || "";
  nodes.total.textContent = String(theses.length);
  nodes.years.textContent = `${yearCounts[0][0]} - ${yearCounts[yearCounts.length - 1][0]}`;
  nodes.themeCount.textContent = String(themeCounts.length);
  nodes.keywords.textContent = keywordCounts.slice(0, 5).map(([keyword]) => keyword).join("、");

  renderBarChart(nodes.timeline, yearCounts);
  renderBarChart(nodes.themeChart, themeCounts.slice(0, 8));

  const keywordWrap = document.querySelector("#advisor-keyword-cloud");
  keywordCounts.forEach(([keyword, count]) => {
    const chip = document.createElement("span");
    chip.className = "keyword-chip";
    chip.innerHTML = `<strong>${keyword}</strong><span>${count}</span>`;
    keywordWrap.appendChild(chip);
  });

  renderTheses(theses);
};

init().catch((error) => {
  nodes.list.innerHTML = `<div class="empty-state">${error.message}</div>`;
});
