const DATA_URL = "./data/theses.json";

const state = {
  theses: [],
  filtered: [],
  abstractLanguage: "zh",
};

const elements = {
  statTotal: document.querySelector("#stat-total"),
  statThemes: document.querySelector("#stat-themes"),
  statAdvisors: document.querySelector("#stat-advisors"),
  statYears: document.querySelector("#stat-years"),
  themeSummary: document.querySelector("#theme-summary"),
  themeFilter: document.querySelector("#theme-filter"),
  yearFilter: document.querySelector("#year-filter"),
  advisorFilter: document.querySelector("#advisor-filter"),
  searchInput: document.querySelector("#search-input"),
  resultCount: document.querySelector("#result-count"),
  resultsList: document.querySelector("#results-list"),
  clearFilters: document.querySelector("#clear-filters"),
  jumpToResults: document.querySelector("#jump-to-results"),
  toggleLanguage: document.querySelector("#toggle-abstract-language"),
  cardTemplate: document.querySelector("#thesis-card-template"),
};

const safeText = (value) => (value || "").trim();

const shortText = (value, limit = 320) => {
  const text = safeText(value).replace(/\s+/g, " ");
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}...`;
};

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-Hant")
  );

const createOption = (label, value = "") => {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
};

const hydrateFilters = () => {
  const themeOptions = uniqueSorted(state.theses.map((item) => item.theme_primary));
  const advisorOptions = uniqueSorted(state.theses.map((item) => item.advisor_zh || "未載明"));
  const yearOptions = uniqueSorted(state.theses.map((item) => item.year)).sort();

  elements.themeFilter.replaceChildren(createOption("全部主題", ""));
  elements.yearFilter.replaceChildren(createOption("全部年份", ""));
  elements.advisorFilter.replaceChildren(createOption("全部指導教授", ""));

  themeOptions.forEach((value) => elements.themeFilter.appendChild(createOption(value, value)));
  yearOptions.forEach((value) => elements.yearFilter.appendChild(createOption(value, value)));
  advisorOptions.forEach((value) =>
    elements.advisorFilter.appendChild(createOption(value, value))
  );
};

const renderSummary = () => {
  const themeCounts = state.theses.reduce((acc, item) => {
    const key = item.theme_primary || "未分類";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const rows = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  elements.themeSummary.replaceChildren();

  rows.forEach(([theme, count]) => {
    const div = document.createElement("div");
    div.className = "theme-row";
    div.innerHTML = `
      <div>
        <strong>${theme}</strong>
        <span>以題名、關鍵字與摘要做自動分群</span>
      </div>
      <strong>${count} 篇</strong>
    `;
    elements.themeSummary.appendChild(div);
  });
};

const applyFilters = () => {
  const searchTerm = safeText(elements.searchInput.value).toLowerCase();
  const theme = elements.themeFilter.value;
  const year = elements.yearFilter.value;
  const advisor = elements.advisorFilter.value;

  state.filtered = state.theses.filter((item) => {
    const matchesTheme = !theme || item.theme_primary === theme;
    const matchesYear = !year || item.year === year;
    const matchesAdvisor = !advisor || (item.advisor_zh || "未載明") === advisor;

    const haystack = [
      item.title_zh,
      item.title_en,
      item.author_zh,
      item.advisor_zh,
      item.keywords_zh,
      item.keywords_en,
      item.abstract_zh,
      item.abstract_en,
      item.theme_primary,
      item.theme_secondary,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    return matchesTheme && matchesYear && matchesAdvisor && matchesSearch;
  });

  renderResults();
};

const renderResults = () => {
  elements.resultsList.replaceChildren();
  elements.resultCount.textContent = `目前顯示 ${state.filtered.length} / ${state.theses.length} 篇`;

  if (state.filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "目前沒有符合條件的論文，試著放寬搜尋或清除篩選。";
    elements.resultsList.appendChild(empty);
    return;
  }

  state.filtered.forEach((item) => {
    const node = elements.cardTemplate.content.cloneNode(true);
    node.querySelector(".year-chip").textContent = item.year;
    node.querySelector(".theme-chip").textContent = item.theme_primary || "未分類";
    node.querySelector(".thesis-title").textContent = item.title_zh || "未命名論文";
    node.querySelector(".thesis-title-en").textContent = item.title_en || "";
    node.querySelector(".author").textContent = item.author_zh || item.author_en || "未載明";
    node.querySelector(".advisor").textContent = item.advisor_zh || item.advisor_en || "未載明";
    node.querySelector(".secondary-theme").textContent = item.theme_secondary || "無";
    node.querySelector(".basis").textContent = item.theme_basis || "無";
    node.querySelector(".keywords").innerHTML = `<strong>關鍵字</strong> ${item.keywords_zh || "無"}`;
    node.querySelector(".abstract-heading").textContent =
      state.abstractLanguage === "zh" ? "中文摘要" : "英文摘要";
    node.querySelector(".abstract").textContent = shortText(
      state.abstractLanguage === "zh" ? item.abstract_zh : item.abstract_en,
      420
    );

    const link = node.querySelector(".detail-link");
    link.href = item.url;

    elements.resultsList.appendChild(node);
  });
};

const updateHeadlineStats = () => {
  const years = uniqueSorted(state.theses.map((item) => item.year)).sort();
  const advisors = uniqueSorted(state.theses.map((item) => item.advisor_zh || "未載明"));
  const themes = uniqueSorted(state.theses.map((item) => item.theme_primary));

  elements.statTotal.textContent = String(state.theses.length);
  elements.statThemes.textContent = String(themes.length);
  elements.statAdvisors.textContent = String(advisors.length);
  elements.statYears.textContent = `${years[0]} - ${years[years.length - 1]}`;
};

const bindEvents = () => {
  [elements.themeFilter, elements.yearFilter, elements.advisorFilter].forEach((element) =>
    element.addEventListener("change", applyFilters)
  );
  elements.searchInput.addEventListener("input", applyFilters);
  elements.clearFilters.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.themeFilter.value = "";
    elements.yearFilter.value = "";
    elements.advisorFilter.value = "";
    applyFilters();
  });
  elements.jumpToResults.addEventListener("click", () =>
    document.querySelector("#results").scrollIntoView({ behavior: "smooth" })
  );
  elements.toggleLanguage.addEventListener("click", () => {
    state.abstractLanguage = state.abstractLanguage === "zh" ? "en" : "zh";
    elements.toggleLanguage.textContent =
      state.abstractLanguage === "zh" ? "摘要顯示：中文" : "摘要顯示：英文";
    renderResults();
  });
};

const init = async () => {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`資料載入失敗：${response.status}`);
  }

  state.theses = await response.json();
  state.filtered = [...state.theses];

  updateHeadlineStats();
  hydrateFilters();
  renderSummary();
  bindEvents();
  renderResults();
};

init().catch((error) => {
  elements.resultCount.textContent = "資料載入失敗";
  elements.resultsList.innerHTML = `<div class="empty-state">${error.message}</div>`;
});
