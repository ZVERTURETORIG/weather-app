const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const form = document.querySelector("#search-form");
const input = document.querySelector("#city-input");
const button = document.querySelector("#search-button");
const themeButton = document.querySelector("#theme-button");
const themeIcon = themeButton.querySelector(".theme-icon");
const themeLabel = themeButton.querySelector(".theme-label");
const installButton = document.querySelector("#install-button");
const results = document.querySelector("#search-results");
const message = document.querySelector("#form-message");
const weatherPanel = document.querySelector("#weather-panel");
const forecastGrid = document.querySelector("#forecast-grid");

const weatherDescriptions = {
  0: "Ясно", 1: "Преимущественно ясно", 2: "Переменная облачность", 3: "Пасмурно",
  45: "Туман", 48: "Изморозь и туман", 51: "Лёгкая морось", 53: "Морось", 55: "Сильная морось",
  56: "Ледяная морось", 57: "Сильная ледяная морось", 61: "Небольшой дождь", 63: "Дождь", 65: "Сильный дождь",
  66: "Ледяной дождь", 67: "Сильный ледяной дождь", 71: "Небольшой снег", 73: "Снег", 75: "Сильный снег",
  77: "Снежные зёрна", 80: "Кратковременный дождь", 81: "Ливень", 82: "Сильный ливень",
  85: "Снегопад", 86: "Сильный снегопад", 95: "Гроза", 96: "Гроза с градом", 99: "Сильная гроза с градом"
};

const weatherEmojis = {
  clear: "☀", partly: "⛅", cloudy: "☁", fog: "〰", rain: "☂", snow: "❄", storm: "ϟ"
};

function conditionType(code, isDay = true) {
  if (code === 0) return isDay ? "clear" : "partly";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return "rain";
  return "partly";
}

function iconMarkup(type) {
  const sun = `<circle class="sun-core" cx="29" cy="29" r="11"/><path class="sun-rays" d="M29 7v5M29 46v5M7 29h5M46 29h5M13.5 13.5l3.6 3.6m23.8 23.8 3.6 3.6m0-31-3.6 3.6M17.1 40.9l-3.6 3.6"/>`;
  const cloud = `<path class="cloud-shadow" d="M20.5 43h21.3a10.2 10.2 0 0 0 .2-20.4 13.7 13.7 0 0 0-25.9-2.5A11.4 11.4 0 0 0 20.5 43Z"/>`;
  const smallCloud = `<path class="cloud-main" d="M20.5 41h21.3a10.2 10.2 0 0 0 .2-20.4 13.7 13.7 0 0 0-25.9-2.5A11.4 11.4 0 0 0 20.5 41Z"/>`;

  let content = "";
  if (type === "clear") content = sun;
  if (type === "partly") content = `${sun}<path class="cloud-shadow" d="M21 46h23a9.5 9.5 0 0 0 0-19 12.3 12.3 0 0 0-23-2.5A10.7 10.7 0 0 0 21 46Z"/><path class="cloud-main" d="M20 43h23a9.5 9.5 0 0 0 0-19A12.3 12.3 0 0 0 20 21.5 10.7 10.7 0 0 0 20 43Z"/>`;
  if (type === "cloudy") content = `${cloud}${smallCloud}`;
  if (type === "fog") content = `<path class="cloud-shadow" d="M20.5 35h21.3a10.2 10.2 0 0 0 .2-20.4 13.7 13.7 0 0 0-25.9-2.5A11.4 11.4 0 0 0 20.5 35Z"/><path class="fog-line" d="M11 42h36M16 49h28"/>`;
  if (type === "rain") content = `${cloud}<path class="rain-line" d="m22 45-2 5m12-5-2 5m12-5-2 5"/>`;
  if (type === "snow") content = `${cloud}<circle class="snow-dot" cx="20" cy="48" r="2.2"/><circle class="snow-dot" cx="31" cy="50" r="2.2"/><circle class="snow-dot" cx="41" cy="47" r="2.2"/>`;
  if (type === "storm") content = `${cloud}<path class="flash" d="m31 39-8 13h7l-2 10 12-16h-8l4-7Z"/>`;
  return `<svg viewBox="0 0 58 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${content}</svg>`;
}

function formatNumber(value, digits = 0) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
}

function formatTime(value) {
  return value ? value.slice(11, 16) : "—:—";
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("ru-RU", options).format(new Date(`${date}T12:00:00`));
}

function locationLabel(place) {
  return [place.name, place.admin1 && place.admin1 !== place.name ? place.admin1 : "", place.country].filter(Boolean).join(", ");
}

function setLoading(isLoading) {
  form.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
  input.disabled = isLoading;
  weatherPanel.classList.toggle("is-loading", isLoading);
  weatherPanel.setAttribute("aria-busy", String(isLoading));
  if (isLoading) {
    message.textContent = "";
    message.classList.remove("is-info");
    results.classList.remove("is-visible");
  }
}

function showError(text) {
  message.classList.remove("is-info");
  message.textContent = text;
}

function showInfo(text) {
  message.classList.add("is-info");
  message.textContent = text;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("api");
    const data = await response.json();
    if (data.error) throw new Error("api");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("timeout");
    if (error instanceof TypeError) throw new Error("network");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function findCities(query) {
  const params = new URLSearchParams({ name: query, count: "5", language: "ru", format: "json" });
  const data = await fetchJson(`${GEOCODING_URL}?${params}`);
  return data.results || [];
}

function renderCityOptions(cities) {
  results.innerHTML = "";
  cities.forEach((city, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "city-option";
    option.setAttribute("role", "option");
    option.innerHTML = `<span class="city-option-pin"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8.3c0 4.2-6 9.1-6 9.1S4 12.5 4 8.3a6 6 0 1 1 12 0Z"/><circle cx="10" cy="8" r="2"/></svg></span><span class="city-option-main">${escapeHtml(city.name)}<span class="city-option-sub">${city.admin1 ? ` · ${escapeHtml(city.admin1)}` : ""}${city.country ? ` · ${escapeHtml(city.country)}` : ""}</span></span><span class="city-option-arrow">${index === 0 ? "Выбрать" : "›"}</span>`;
    option.addEventListener("click", () => loadWeather(city));
    results.append(option);
  });
  results.classList.add("is-visible");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function onSearch(event) {
  event.preventDefault();
  const query = input.value.trim();
  results.classList.remove("is-visible");
  message.textContent = "";
  message.classList.remove("is-info");
  if (query.length < 2) {
    showError("Введите название города (минимум 2 символа).");
    input.focus();
    return;
  }

  setLoading(true);
  try {
    const cities = await findCities(query);
    if (!cities.length) {
      showError(`Не нашли «${query}». Проверьте название или попробуйте добавить страну.`);
      return;
    }
    setLoading(false);
    if (cities.length > 1) {
      renderCityOptions(cities);
      return;
    }
    await loadWeather(cities[0]);
  } catch (error) {
    showError(errorMessage(error));
  } finally {
    setLoading(false);
  }
}

function errorMessage(error) {
  if (!navigator.onLine || error.message === "network") return "Не удалось подключиться к интернету. Проверьте соединение и попробуйте снова.";
  if (error.message === "timeout") return "Сервер отвечает слишком долго. Попробуйте ещё раз чуть позже.";
  return "Не удалось загрузить погоду. Попробуйте ещё раз через минуту.";
}

async function loadWeather(place) {
  results.classList.remove("is-visible");
  setLoading(true);
  try {
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
      forecast_days: "7",
      timezone: "auto",
      wind_speed_unit: "kmh"
    });
    const forecast = await fetchJson(`${FORECAST_URL}?${params}`);
    renderWeather(place, forecast);
    input.value = place.name;
    message.textContent = "";
  } catch (error) {
    showError(errorMessage(error));
  } finally {
    setLoading(false);
  }
}

function renderWeather(place, data) {
  const current = data.current;
  const daily = data.daily;
  const code = current.weather_code;
  const type = conditionType(code, current.is_day === 1);
  const currentTemp = Math.round(current.temperature_2m);
  const feels = Math.round(current.apparent_temperature);
  const wind = Math.round(current.wind_speed_10m);
  const humidity = Math.round(current.relative_humidity_2m);
  const todayMax = Math.round(daily.temperature_2m_max[0]);
  const todayMin = Math.round(daily.temperature_2m_min[0]);

  document.querySelector("#location-name").textContent = locationLabel(place);
  document.querySelector("#local-time").textContent = `${formatDate(daily.time[0], { weekday: "long", day: "numeric", month: "long" })} · местное время ${formatTime(current.time)}`;
  document.querySelector("#current-icon").innerHTML = iconMarkup(type);
  document.querySelector("#temperature").innerHTML = `${currentTemp}<span>°</span>`;
  document.querySelector("#condition-label").textContent = weatherDescriptions[code] || "Переменная погода";
  document.querySelector("#high-low").textContent = `Ощущается как ${feels}° · ${todayMax}° / ${todayMin}°`;
  document.querySelector("#today-icon").textContent = weatherEmojis[type];
  document.querySelector("#today-summary").textContent = `Сегодня: ${weatherDescriptions[daily.weather_code[0]] || "Переменная погода"}`;
  document.querySelector("#sunrise").textContent = formatTime(daily.sunrise[0]);
  document.querySelector("#sunset").textContent = formatTime(daily.sunset[0]);

  document.querySelector("#wind-value").textContent = formatNumber(wind);
  document.querySelector("#wind-note").textContent = `${windDirection(current.wind_direction_10m)} · ${windDescription(wind)}`;
  document.querySelector("#wind-meter-fill").style.width = `${Math.min(100, Math.max(7, wind * 2.3))}%`;
  document.querySelector("#humidity-value").textContent = formatNumber(humidity);
  document.querySelector(".humidity-bars").querySelectorAll("i").forEach((bar, index) => bar.classList.toggle("active", index < Math.round(humidity / 9)));
  document.querySelector("#feels-value").textContent = formatNumber(feels);
  document.querySelector("#feels-note").textContent = temperatureDifference(currentTemp, feels);
  document.querySelector("#feels-track-fill").style.width = `${Math.max(9, Math.min(95, (feels + 25) / 65 * 100))}%`;

  forecastGrid.innerHTML = daily.time.map((date, index) => {
    const dayType = conditionType(daily.weather_code[index]);
    const dayLabel = index === 0 ? "Сегодня" : formatDate(date, { weekday: "short" }).replace("г.", "");
    const dateLabel = formatDate(date, { day: "numeric", month: "short" }).replace("г.", "");
    const rain = daily.precipitation_probability_max?.[index];
    const rainLabel = Number.isFinite(rain) && rain > 15 ? `☂ ${rain}%` : "";
    return `<article class="forecast-card"><span class="forecast-day">${dayLabel}</span><span class="forecast-date">${dateLabel}</span><span class="weather-icon forecast-icon" aria-label="${escapeHtml(weatherDescriptions[daily.weather_code[index]] || "Погода")}">${iconMarkup(dayType)}</span><span class="forecast-range"><span class="forecast-max">${Math.round(daily.temperature_2m_max[index])}°</span><span class="forecast-min">${Math.round(daily.temperature_2m_min[index])}°</span></span><span class="forecast-rain">${rainLabel}</span></article>`;
  }).join("");
}

function windDirection(degrees) {
  if (!Number.isFinite(degrees)) return "Ветер";
  return ["Северный", "Северо-восточный", "Восточный", "Юго-восточный", "Южный", "Юго-западный", "Западный", "Северо-западный"][Math.round(degrees / 45) % 8];
}

function windDescription(speed) {
  if (speed < 6) return "тихий ветер";
  if (speed < 20) return "умеренный ветер";
  return "сильный ветер";
}

function temperatureDifference(air, feels) {
  const difference = feels - air;
  if (Math.abs(difference) < 2) return "Похоже на температуру воздуха";
  return difference > 0 ? `Теплее на ${difference}° из-за погоды` : `Прохладнее на ${Math.abs(difference)}° из-за ветра`;
}

form.addEventListener("submit", onSearch);
input.addEventListener("input", () => {
  message.textContent = "";
  message.classList.remove("is-info");
  results.classList.remove("is-visible");
});
document.addEventListener("click", event => {
  if (!form.contains(event.target)) results.classList.remove("is-visible");
});
window.addEventListener("online", () => {
  if (message.textContent.includes("интернет")) message.textContent = "Интернет снова доступен. Нажмите «Показать погоду».";
});

const sunIcon = '<circle cx="10" cy="10" r="3.5"/><path d="M10 1.5v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6-1.4 1.4m-9.2 9.2L4 16m12 0-1.4-1.4M4 4l1.4 1.4"/>';
const moonIcon = '<path d="M17.8 12.4A7.5 7.5 0 0 1 7.6 2.2 7.8 7.8 0 1 0 17.8 12.4Z"/>';

function updateTheme(theme, save = true) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeButton.setAttribute("aria-pressed", String(isDark));
  themeButton.setAttribute("aria-label", isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему");
  themeButton.title = isDark ? "Включить светлую тему" : "Включить тёмную тему";
  themeLabel.textContent = isDark ? "Светлая" : "Тёмная";
  themeIcon.innerHTML = isDark ? sunIcon : moonIcon;
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#101a2a" : "#f3f7fb";
  if (save) {
    try { localStorage.setItem("weather-theme", isDark ? "dark" : "light"); } catch {}
  }
}

themeButton.addEventListener("click", () => {
  updateTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
updateTheme(document.documentElement.dataset.theme || "dark", false);

let installPrompt = null;
const appIsInstalled = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
});

installButton.addEventListener("click", async () => {
  if (appIsInstalled()) {
    showInfo("Приложение уже установлено на этом устройстве.");
    return;
  }

  if (installPrompt) {
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    if (choice.outcome === "accepted") installButton.hidden = true;
    return;
  }

  showInfo("Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».");
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
  showInfo("Погода установлена. Теперь её можно открыть с рабочего стола.");
});

if (appIsInstalled()) installButton.hidden = true;

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./service-worker.js").catch(error => {
    console.warn("Не удалось включить офлайн-режим:", error);
  });
}

// Для учебного примера при первом открытии автоматически показываем Астану.
loadWeather({ name: "Астана", country: "Казахстан", latitude: 51.1694, longitude: 71.4491 });
