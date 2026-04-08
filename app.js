const DATA_URL = "./data/theses.json";

const state = {
  theses: [],
  filtered: [],
  normalizedAdvisors: [],
  abstractLanguage: "zh",
  dashboardYear: "",
};

const elements = {
  statTotal: document.querySelector("#stat-total"),
  statThemes: document.querySelector("#stat-themes"),
  statAdvisors: document.querySelector("#stat-advisors"),
  statYears: document.querySelector("#stat-years"),
  themeSummary: document.querySelector("#theme-summary"),
  themeChart: document.querySelector("#theme-chart"),
  yearChart: document.querySelector("#year-chart"),
  themeDonut: document.querySelector("#theme-donut"),
  themeDonutLegend: document.querySelector("#theme-donut-legend"),
  advisorChart: document.querySelector("#advisor-chart"),
  dashboardYearFilter: document.querySelector("#dashboard-year-filter"),
  themeYearHeatmap: document.querySelector("#theme-year-heatmap"),
  advisorThemeHeatmap: document.querySelector("#advisor-theme-heatmap"),
  keywordVisualization: document.querySelector("#keyword-visualization"),
  advisorDirectory: document.querySelector("#advisor-directory"),
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

const createOption = (label, value = "") => {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
};

const setFilters = ({ theme, year, advisor, query } = {}) => {
  if (theme !== undefined) {
    elements.themeFilter.value = theme;
  }
  if (year !== undefined) {
    elements.yearFilter.value = year;
    elements.dashboardYearFilter.value = year;
    state.dashboardYear = year;
  }
  if (advisor !== undefined) {
    elements.advisorFilter.value = advisor;
  }
  if (query !== undefined) {
    elements.searchInput.value = query;
  }
};

const toggleFilterValue = (current, next) => (current === next ? "" : next);

const normalizeRecords = (rows) =>
  rows.map((item) => {
    const advisor = extractAdvisor(item);
    return {
      ...item,
      advisor_name: advisor.name,
      advisor_english: advisor.english,
      advisor_slug: advisor.slug,
    };
  });

const hydrateFilters = () => {
  const themeOptions = uniqueSorted(state.theses.map((item) => item.theme_primary));
  const advisorOptions = uniqueSorted(state.theses.map((item) => item.advisor_name));
  const yearOptions = uniqueSorted(state.theses.map((item) => item.year)).sort();

  elements.themeFilter.replaceChildren(createOption("全部主題", ""));
  elements.yearFilter.replaceChildren(createOption("全部年份", ""));
  elements.advisorFilter.replaceChildren(createOption("全部指導教授", ""));

  themeOptions.forEach((value) => elements.themeFilter.appendChild(createOption(value, value)));
  yearOptions.forEach((value) => elements.yearFilter.appendChild(createOption(value, value)));
  advisorOptions.forEach((value) =>
    elements.advisorFilter.appendChild(createOption(value, value))
  );
  elements.dashboardYearFilter.replaceChildren(createOption("全部年度", ""));
  yearOptions.forEach((value) =>
    elements.dashboardYearFilter.appendChild(createOption(value, value))
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
    div.className = `theme-row is-clickable ${elements.themeFilter.value === theme ? "is-selected" : ""}`;
    div.innerHTML = `
      <div>
        <strong>${theme}</strong>
        <span>依題名、關鍵字與摘要做規則式分群</span>
      </div>
      <strong>${count} 篇</strong>
    `;
    div.addEventListener("click", () => {
      setFilters({
        theme: toggleFilterValue(elements.themeFilter.value, theme),
        year: state.dashboardYear || "",
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    });
    elements.themeSummary.appendChild(div);
  });
};

const renderBarChart = (
  container,
  entries,
  colorClass = "",
  activeLabel = "",
  onClick = null,
  selectedLabel = ""
) => {
  container.replaceChildren();
  const max = Math.max(...entries.map(([, value]) => value), 1);

  entries.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = `chart-row ${colorClass} ${activeLabel && label === activeLabel ? "is-active" : ""} ${selectedLabel && label === selectedLabel ? "is-selected" : ""} ${onClick ? "is-clickable" : ""}`.trim();
    row.innerHTML = `
      <div class="chart-label">${label}</div>
      <div class="chart-track">
        <div class="chart-bar" style="width:${(value / max) * 100}%"></div>
      </div>
      <div class="chart-value">${value}</div>
    `;
    if (onClick) {
      row.addEventListener("click", () => onClick(label, value));
    }
    container.appendChild(row);
  });
};

const renderDonutChart = (
  container,
  legendNode,
  entries,
  totalLabel = "總論文",
  onClick = null,
  selectedLabel = ""
) => {
  container.replaceChildren();
  legendNode.replaceChildren();
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  const palette = [
    "#174c4f",
    "#b26139",
    "#7fa38f",
    "#db8d5a",
    "#437975",
    "#cc6f5b",
    "#9ebea8",
    "#8d5b4c",
    "#5f7f96",
  ];
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 240 240");

  const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bgCircle.setAttribute("cx", "120");
  bgCircle.setAttribute("cy", "120");
  bgCircle.setAttribute("r", String(radius));
  bgCircle.setAttribute("fill", "none");
  bgCircle.setAttribute("stroke", "rgba(23, 76, 79, 0.08)");
  bgCircle.setAttribute("stroke-width", "26");
  svg.appendChild(bgCircle);

  entries.forEach(([label, value], index) => {
    const color = palette[index % palette.length];
    const length = (value / total) * circumference;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "120");
    circle.setAttribute("cy", "120");
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", "26");
    circle.setAttribute("stroke-linecap", "butt");
    circle.setAttribute("stroke-dasharray", `${length} ${circumference - length}`);
    circle.setAttribute("stroke-dashoffset", String(-offset));
    svg.appendChild(circle);
    offset += length;

    const row = document.createElement("div");
    row.className = `legend-row ${onClick ? "is-clickable" : ""} ${selectedLabel && selectedLabel === label ? "is-selected" : ""}`;
    row.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span class="legend-label">${label}</span>
      <span class="legend-value">${value} (${Math.round((value / total) * 100)}%)</span>
    `;
    if (onClick) {
      row.addEventListener("click", () => onClick(label, value));
    }
    legendNode.appendChild(row);
  });

  const hole = document.createElement("div");
  hole.className = "donut-hole";
  hole.innerHTML = `<div><strong>${total}</strong><span>${totalLabel}</span></div>`;
  container.appendChild(svg);
  container.appendChild(hole);
};

const renderHeatmap = (container, columns, rows, getValue, onCellClick, isSelected) => {
  container.replaceChildren();
  const values = [];
  rows.forEach((row) => columns.forEach((col) => values.push(getValue(row, col))));
  const max = Math.max(...values, 1);

  const header = document.createElement("div");
  header.className = "heatmap-header";
  header.appendChild(Object.assign(document.createElement("div"), { className: "heatmap-corner" }));
  columns.forEach((col) => {
    const div = document.createElement("div");
    div.className = "heatmap-col";
    div.textContent = col;
    header.appendChild(div);
  });
  container.appendChild(header);

  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "heatmap-row";
    const label = document.createElement("div");
    label.className = "heatmap-label";
    label.textContent = row;
    rowEl.appendChild(label);
    columns.forEach((col) => {
      const value = getValue(row, col);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `heatmap-cell ${isSelected(row, col) ? "is-selected" : ""}`;
      cell.style.background = `rgba(23, 76, 79, ${0.08 + (value / max) * 0.72})`;
      cell.style.color = value / max > 0.52 ? "#fffaf3" : "var(--deep)";
      cell.textContent = value ? String(value) : "-";
      cell.addEventListener("click", () => onCellClick(row, col));
      rowEl.appendChild(cell);
    });
    container.appendChild(rowEl);
  });
};

const renderCharts = () => {
  const chartSource = state.dashboardYear
    ? state.theses.filter((item) => item.year === state.dashboardYear)
    : state.theses;

  const themeCounts = Object.entries(
    chartSource.reduce((acc, item) => {
      acc[item.theme_primary] = (acc[item.theme_primary] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const yearCounts = Object.entries(
    state.theses.reduce((acc, item) => {
      acc[item.year] = (acc[item.year] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => Number(a[0]) - Number(b[0]));

  const advisorCounts = Object.entries(
    chartSource.reduce((acc, item) => {
      acc[item.advisor_name] = (acc[item.advisor_name] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  renderBarChart(elements.themeChart, themeCounts, "theme-bars", "", (label) => {
    setFilters({
      theme: toggleFilterValue(elements.themeFilter.value, label),
      year: state.dashboardYear || "",
    });
    applyFilters();
    document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
  }, elements.themeFilter.value);
  renderBarChart(elements.yearChart, yearCounts, "year-bars", state.dashboardYear, (label) => {
    setFilters({ year: toggleFilterValue(elements.yearFilter.value, label) });
    applyFilters();
    document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
  }, elements.yearFilter.value);
  renderBarChart(elements.advisorChart, advisorCounts, "advisor-bars", "", (label) => {
    setFilters({
      advisor: toggleFilterValue(elements.advisorFilter.value, label),
      year: state.dashboardYear || "",
    });
    applyFilters();
    document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
  }, elements.advisorFilter.value);
  renderDonutChart(
    elements.themeDonut,
    elements.themeDonutLegend,
    themeCounts,
    state.dashboardYear ? `${state.dashboardYear} 年` : "篇論文",
    (label) => {
      setFilters({
        theme: toggleFilterValue(elements.themeFilter.value, label),
        year: state.dashboardYear || "",
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    },
    elements.themeFilter.value
  );
  renderKeywords(chartSource);
  renderHeatmaps();
};

const renderKeywords = (source = state.theses) => {
  const keywordCounts = source.reduce((acc, item) => {
    safeText(item.keywords_zh)
      .split("；")
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .forEach((keyword) => {
        acc[keyword] = (acc[keyword] || 0) + 1;
      });
    return acc;
  }, {});

  const entries = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24);

  const max = Math.max(...entries.map(([, count]) => count), 1);
  elements.keywordVisualization.replaceChildren();

  entries.forEach(([keyword, count]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `keyword-chip ${elements.searchInput.value === keyword ? "is-selected" : ""}`;
    chip.style.setProperty("--keyword-scale", String(count / max));
    chip.innerHTML = `<strong>${keyword}</strong><span>${count}</span>`;
    chip.addEventListener("click", () => {
      setFilters({
        query: toggleFilterValue(elements.searchInput.value, keyword),
        year: state.dashboardYear || "",
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    });
    elements.keywordVisualization.appendChild(chip);
  });
};

const renderHeatmaps = () => {
  const allYears = uniqueSorted(state.theses.map((item) => item.year)).sort();
  const themeRows = uniqueSorted(state.theses.map((item) => item.theme_primary));
  const advisorRows = Object.entries(
    state.theses.reduce((acc, item) => {
      acc[item.advisor_name] = (acc[item.advisor_name] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  renderHeatmap(
    elements.themeYearHeatmap,
    allYears,
    themeRows,
    (theme, year) =>
      state.theses.filter((item) => item.theme_primary === theme && item.year === year).length,
    (theme, year) => {
      setFilters({
        theme: toggleFilterValue(elements.themeFilter.value, theme),
        year: toggleFilterValue(elements.yearFilter.value, year),
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    },
    (theme, year) => elements.themeFilter.value === theme && elements.yearFilter.value === year
  );

  const themesForAdvisor = themeRows;
  renderHeatmap(
    elements.advisorThemeHeatmap,
    themesForAdvisor,
    advisorRows,
    (advisor, theme) =>
      state.theses.filter(
        (item) => item.advisor_name === advisor && item.theme_primary === theme
      ).length,
    (advisor, theme) => {
      setFilters({
        advisor: toggleFilterValue(elements.advisorFilter.value, advisor),
        theme: toggleFilterValue(elements.themeFilter.value, theme),
        year: state.dashboardYear || "",
      });
      applyFilters();
      document.querySelector("#results").scrollIntoView({ behavior: "smooth" });
    },
    (advisor, theme) =>
      elements.advisorFilter.value === advisor && elements.themeFilter.value === theme
  );
};

const renderAdvisorDirectory = () => {
  const grouped = state.theses.reduce((acc, item) => {
    if (!acc[item.advisor_slug]) {
      acc[item.advisor_slug] = {
        slug: item.advisor_slug,
        name: item.advisor_name,
        english: item.advisor_english,
        count: 0,
        themes: new Set(),
      };
    }
    acc[item.advisor_slug].count += 1;
    if (item.theme_primary) {
      acc[item.advisor_slug].themes.add(item.theme_primary);
    }
    return acc;
  }, {});

  const cards = Object.values(grouped).sort((a, b) => b.count - a.count);
  state.normalizedAdvisors = cards;
  elements.advisorDirectory.replaceChildren();

  cards.forEach((advisor) => {
    const anchor = document.createElement("a");
    anchor.className = "advisor-card";
    anchor.href = `./advisors/${advisor.slug}.html`;
    anchor.innerHTML = `
      <div>
        <strong>${advisor.name}</strong>
        <p>${advisor.english || " "}</p>
      </div>
      <div class="advisor-card-meta">
        <span>${advisor.count} 篇</span>
        <small>${[...advisor.themes].slice(0, 2).join("、")}</small>
      </div>
    `;
    elements.advisorDirectory.appendChild(anchor);
  });
};

const applyFilters = () => {
  const searchTerm = safeText(elements.searchInput.value).toLowerCase();
  const theme = elements.themeFilter.value;
  const year = elements.yearFilter.value;
  const advisor = elements.advisorFilter.value;

  if (elements.dashboardYearFilter.value !== year) {
    elements.dashboardYearFilter.value = year;
    state.dashboardYear = year;
    renderCharts();
  }

  state.filtered = state.theses.filter((item) => {
    const matchesTheme = !theme || item.theme_primary === theme;
    const matchesYear = !year || item.year === year;
    const matchesAdvisor = !advisor || item.advisor_name === advisor;

    const haystack = [
      item.title_zh,
      item.title_en,
      item.author_zh,
      item.author_en,
      item.advisor_name,
      item.advisor_english,
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
    node.querySelector(".advisor").textContent = item.advisor_name || item.advisor_english || "未載明";
    node.querySelector(".secondary-theme").textContent = item.theme_secondary || "無";
    node.querySelector(".basis").textContent = item.theme_basis || "無";
    node.querySelector(".keywords").innerHTML = `<strong>關鍵字</strong> ${item.keywords_zh || "無"}`;
    node.querySelector(".abstract-heading").textContent =
      state.abstractLanguage === "zh" ? "中文摘要" : "英文摘要";
    node.querySelector(".abstract").textContent = shortText(
      state.abstractLanguage === "zh" ? item.abstract_zh : item.abstract_en,
      420
    );

    const detailLink = node.querySelector(".detail-link");
    detailLink.href = item.url;

    const inlineLink = node.querySelector(".detail-link-inline");
    inlineLink.href = item.url;

    const advisorPageLink = node.querySelector(".advisor-page-link");
    advisorPageLink.href = `./advisors/${item.advisor_slug}.html`;

    elements.resultsList.appendChild(node);
  });
};

const updateHeadlineStats = () => {
  const years = uniqueSorted(state.theses.map((item) => item.year)).sort();
  const advisors = uniqueSorted(state.theses.map((item) => item.advisor_slug));
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
  elements.dashboardYearFilter.addEventListener("change", () => {
    state.dashboardYear = elements.dashboardYearFilter.value;
    elements.yearFilter.value = state.dashboardYear;
    renderCharts();
    applyFilters();
  });
  elements.searchInput.addEventListener("input", applyFilters);
  elements.clearFilters.addEventListener("click", () => {
    setFilters({ query: "", theme: "", year: "", advisor: "" });
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

const applyInitialQuery = () => {
  const params = new URLSearchParams(window.location.search);
  const advisor = safeText(params.get("advisor"));
  const theme = safeText(params.get("theme"));
  const year = safeText(params.get("year"));
  const q = safeText(params.get("q"));

  if (advisor) {
    elements.advisorFilter.value = advisor;
  }
  if (theme) {
    elements.themeFilter.value = theme;
  }
  if (year) {
    elements.yearFilter.value = year;
    elements.dashboardYearFilter.value = year;
    state.dashboardYear = year;
  }
  if (q) {
    elements.searchInput.value = q;
  }
};

const init = async () => {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`資料載入失敗：${response.status}`);
  }

  state.theses = normalizeRecords(await response.json());
  state.filtered = [...state.theses];

  updateHeadlineStats();
  hydrateFilters();
  renderSummary();
  renderCharts();
  renderAdvisorDirectory();
  bindEvents();
  applyInitialQuery();
  applyFilters();
  renderResults();
};

init().catch((error) => {
  elements.resultCount.textContent = "資料載入失敗";
  elements.resultsList.innerHTML = `<div class="empty-state">${error.message}</div>`;
});
