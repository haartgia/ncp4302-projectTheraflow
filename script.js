const menuItems = document.querySelectorAll(".menu li");
const menu = document.querySelector(".menu");
const activeIndicator = document.querySelector(".active-indicator");
const sidebar = document.getElementById("sidebar");
const pinToggle = document.getElementById("pinToggle");
const themeToggle = document.getElementById("themeToggle");
const logoutBtn = document.getElementById("logoutBtn");
const streakBadge = document.getElementById("streakBadge");
const streakDots = document.querySelectorAll(".streak-dot");
const calendarMonth = document.getElementById("calendarMonth");
const calendarDates = document.getElementById("calendarDates");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");

const STORAGE_KEYS = {
    pinned: "theraflow.sidebarPinned",
    darkMode: "theraflow.darkMode",
    doctorProfile: "theraflow.doctorProfile",
    session: "theraflow.session"
};

function initializeRootAuthGuard() {
    const protectedContent = document.getElementById("protected-dashboard-content");
    const signinPrompt = document.getElementById("dashboard-signin-prompt");

    if (!protectedContent && !signinPrompt) {
        return;
    }

    function hasActiveSession() {
        const userToken = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
        if (userToken) {
            return true;
        }

        const directFlag = String(localStorage.getItem("isLoggedIn") || sessionStorage.getItem("isLoggedIn") || "").toLowerCase();
        if (directFlag === "true" || directFlag === "1") {
            return true;
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEYS.session) || sessionStorage.getItem(STORAGE_KEYS.session);
            if (!raw) return false;
            const data = JSON.parse(raw);
            return data?.authed === true;
        } catch {
            return false;
        }
    }

    function applyAuthState() {
        const authed = hasActiveSession();

        if (protectedContent) {
            protectedContent.style.display = authed ? "block" : "none";
            protectedContent.setAttribute("aria-hidden", String(!authed));
        }
        if (signinPrompt) {
            signinPrompt.hidden = authed;
            signinPrompt.setAttribute("aria-hidden", String(authed));
        }

        document.body.classList.toggle("is-authed", authed);
    }

    applyAuthState();
    window.addEventListener("storage", applyAuthState);
}

// ── Glove Status Badge (Home Dashboard) ──────────────────────────────────────
// Reads the `theraflow_glove` localStorage key set by the Exercises page and
// updates the indicator badge on the Home dashboard in real-time.
(function initGloveStatusBadge() {
    const badge = document.getElementById("gloveStatusBadge");
    if (!badge) return;

    function refresh() {
        try {
            const raw  = localStorage.getItem("theraflow_glove");
            const data = raw ? JSON.parse(raw) : null;
            const icon  = badge.querySelector("i");
            const label = badge.querySelector("span");

            if (!data || !data.connected) {
                badge.className = "glove-status-badge is-offline";
                if (icon)  icon.className   = "fa-solid fa-circle-xmark";
                if (label) label.textContent = "Glove Offline";
            } else if (data.sessionActive) {
                badge.className = "glove-status-badge is-active";
                if (icon)  icon.className   = "fa-solid fa-circle-dot";
                if (label) label.textContent = `Session Active \u2014 ${data.sessionReps || 0} reps`;
            } else {
                badge.className = "glove-status-badge is-connected";
                if (icon)  icon.className   = "fa-solid fa-circle-check";
                if (label) label.textContent = `${data.name || "Glove"} Connected`;
            }
        } catch { /* ignore parse errors */ }
    }

    refresh();
    window.addEventListener("storage", refresh);   // cross-tab updates
    setInterval(refresh, 3000);                    // same-tab polling
}());

const CALENDAR_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const todayDate = new Date();
const calendarViewDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
const calendarPlan = {
    template_name: "Therapy",
    duration_min: 20,
    target_repetitions: 120,
    sessions_per_day: 1,
    source: "default"
};

function getMondayFirstDayIndex(date) {
    const jsDay = date.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}

function getMonthActivityMeta(year, month, dateNum, isCurrentMonth) {
    if (!isCurrentMonth) {
        return { label: "", showDot: false, info: "" };
    }

    const isTodayMonth = year === todayDate.getFullYear() && month === todayDate.getMonth();
    if (isTodayMonth && dateNum < todayDate.getDate()) {
        return { label: "", showDot: false, info: "" };
    }

    const sessionsPerDay = Math.max(1, Number(calendarPlan.sessions_per_day || 0));
    const duration = Number(calendarPlan.duration_min || 0);
    const reps = Number(calendarPlan.target_repetitions || 0);
    const planName = String(calendarPlan.template_name || "Therapy").trim() || "Therapy";

    const infoParts = [planName, sessionsPerDay === 1 ? "1 session" : `${sessionsPerDay} sessions`];
    if (duration > 0) {
        infoParts.push(`${duration} min`);
    }
    if (reps > 0) {
        infoParts.push(`${reps} reps`);
    }

    return {
        label: "",
        showDot: true,
        info: infoParts.join(" • ")
    };
}

function createCalendarCell({ year, month, dateNum, isCurrentMonth }) {
    const dayCell = document.createElement("button");
    dayCell.type = "button";
    dayCell.className = "calendar-day";

    const isToday =
        year === todayDate.getFullYear() &&
        month === todayDate.getMonth() &&
        dateNum === todayDate.getDate();

    if (!isCurrentMonth) {
        dayCell.classList.add("is-outside");
    }
    if (isToday) {
        dayCell.classList.add("is-today");
    }

    const dayNumber = document.createElement("span");
    dayNumber.className = "calendar-date-number";
    dayNumber.textContent = String(dateNum);

    const activityMeta = getMonthActivityMeta(year, month, dateNum, isCurrentMonth);
    dayCell.appendChild(dayNumber);

    if (activityMeta.info) {
        const tooltip = document.createElement("span");
        tooltip.className = "calendar-tooltip";
        tooltip.textContent = activityMeta.info;
        dayCell.setAttribute("aria-label", `${CALENDAR_LABELS[month]} ${dateNum}: ${activityMeta.info}`);
        dayCell.appendChild(tooltip);
    }

    if (activityMeta.showDot) {
        const activityDot = document.createElement("span");
        activityDot.className = "calendar-cell-dot";
        dayCell.appendChild(activityDot);
    }

    return dayCell;
}

function renderCalendar() {
    if (!calendarMonth || !calendarDates) {
        return;
    }

    const viewYear = calendarViewDate.getFullYear();
    const viewMonth = calendarViewDate.getMonth();

    calendarMonth.textContent = `${CALENDAR_LABELS[viewMonth]} ${viewYear}`;

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = getMondayFirstDayIndex(firstOfMonth);

    const totalCells = startOffset + daysInMonth > 35 ? 42 : 35;
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    calendarDates.innerHTML = "";

    for (let i = 0; i < totalCells; i += 1) {
        let year = viewYear;
        let month = viewMonth;
        let dateNum;
        let isCurrentMonth = true;

        if (i < startOffset) {
            isCurrentMonth = false;
            dateNum = prevMonthDays - startOffset + i + 1;
            month = viewMonth - 1;
            if (month < 0) {
                month = 11;
                year -= 1;
            }
        } else if (i >= startOffset + daysInMonth) {
            isCurrentMonth = false;
            dateNum = i - (startOffset + daysInMonth) + 1;
            month = viewMonth + 1;
            if (month > 11) {
                month = 0;
                year += 1;
            }
        } else {
            dateNum = i - startOffset + 1;
        }

        calendarDates.appendChild(createCalendarCell({ year, month, dateNum, isCurrentMonth }));
    }
}

function updateCalendarPlan(data) {
    calendarPlan.template_name = String(data?.template_name || "Therapy");
    calendarPlan.duration_min = Number(data?.duration_min || 0);
    calendarPlan.target_repetitions = Number(data?.target_repetitions || 0);
    calendarPlan.sessions_per_day = Number(data?.sessions_per_day || 1);
}

function loadCalendarPlan() {
    if (!calendarMonth || !calendarDates) {
        return;
    }

    fetch("api/patient/therapy_plan.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load therapy plan.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load therapy plan.");
            }
            updateCalendarPlan(payload.plan || {});
            renderCalendar();
        })
        .catch(() => {
            updateCalendarPlan({});
            renderCalendar();
        });
}

function updateActiveIndicator() {
    if (!menu || !activeIndicator) {
        return;
    }

    const activeItem = menu.querySelector("li.active");
    if (!activeItem) {
        activeIndicator.style.opacity = "0";
        return;
    }

    activeIndicator.style.opacity = "1";
    const indicatorTop = menu.offsetTop + activeItem.offsetTop;
    activeIndicator.style.top = `${indicatorTop}px`;
    activeIndicator.style.height = `${activeItem.offsetHeight}px`;
}

function bindSidebarMotionSync() {
    if (!sidebar) {
        return;
    }

    sidebar.addEventListener("mouseenter", () => {
        requestAnimationFrame(updateActiveIndicator);
        setTimeout(updateActiveIndicator, 180);
        setTimeout(updateActiveIndicator, 320);
    });

    sidebar.addEventListener("mouseleave", () => {
        requestAnimationFrame(updateActiveIndicator);
        setTimeout(updateActiveIndicator, 180);
        setTimeout(updateActiveIndicator, 320);
    });
}

menuItems.forEach(item => {
    item.addEventListener("click", () => {
        const targetPage = item.dataset.page;
        if (targetPage) {
            window.location.href = targetPage;
            return;
        }

        if (document.body.classList.contains("login-page") || document.body.classList.contains("registration-page")) {
            return;
        }

        menuItems.forEach(i => i.classList.remove("active"));

        item.classList.add("active");
        updateActiveIndicator();

    });
});

function applyPinnedState(isPinned) {
    sidebar.classList.toggle("is-pinned", isPinned);
    sidebar.classList.toggle("is-collapsed", !isPinned);
    if (pinToggle) {
        pinToggle.setAttribute("aria-pressed", String(isPinned));
        pinToggle.title = isPinned ? "Unpin sidebar" : "Pin sidebar";
    }
}

function applyTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    if (themeToggle) {
        const icon = themeToggle.querySelector("i");
        if (icon) {
            icon.className = isDark ? "fa-regular fa-sun" : "fa-regular fa-moon";
        }
        themeToggle.setAttribute("aria-pressed", String(isDark));
    }
}

function initializeStreak(daysCompleted) {
    const clampedDays = Math.max(0, Math.min(daysCompleted, streakDots.length));

    streakDots.forEach((dot, index) => {
        dot.classList.toggle("active", index < clampedDays);
    });

    if (streakBadge) {
        streakBadge.classList.toggle("active", clampedDays > 0);
        streakBadge.innerHTML = `<i class="fa-solid fa-fire"></i> ${clampedDays} day${clampedDays === 1 ? "" : "s"}`;
    }
}

function initializePatientDashboardVisuals() {
    const completionRing = document.getElementById("patientCompletionRing");
    const completionValue = document.getElementById("patientCompletionValue");
    const completionLabel = document.querySelector(".patient-progress-label");
    const actionRings = document.querySelectorAll("[data-progress-ring]");
    const daySubheader = document.querySelector(".header-left .subheader");
    const nextExerciseDescription = document.getElementById("nextExerciseDescription");

    if (!completionRing && !actionRings.length && !daySubheader && !nextExerciseDescription) {
        return;
    }

    function readGloveState() {
        try {
            const raw = localStorage.getItem("theraflow_glove");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function applyProgressRing(element, percent) {
        const clampedPercent = Math.max(0, Math.min(Number(percent) || 0, 100));
        element.style.setProperty("--progress", String(clampedPercent));
        element.dataset.progressText = `${Math.round(clampedPercent)}% done`;
        element.setAttribute("aria-label", `${Math.round(clampedPercent)} percent complete`);
    }

    function refreshDashboardVisuals() {
        const gloveState = readGloveState();
        const sessionReps = Math.max(0, Number(gloveState.sessionReps || 0));
        const targetRepetitions = Math.max(1, Number(gloveState.targetRepetitions || 120));
        const completionPercent = Math.round((sessionReps / targetRepetitions) * 100);
        const streakDays = sessionReps > 0 ? 1 : 0;

        initializeStreak(streakDays);

        if (daySubheader) {
            daySubheader.textContent = `Day ${streakDays} of Therapy`;
        }

        if (completionRing) {
            applyProgressRing(completionRing, completionPercent);
            completionRing.setAttribute("aria-label", `Completion progress ${completionPercent} percent`);
        }

        if (completionValue) {
            completionValue.textContent = `${completionPercent}%`;
        }

        if (completionLabel) {
            completionLabel.textContent = completionPercent > 0
                ? `${sessionReps} of ${targetRepetitions} guided repetitions completed today`
                : "No sessions completed yet";
        }

        actionRings.forEach(ring => {
            const ringKind = String(ring.dataset.progressKind || "");
            const ringPercent = ringKind === "grip"
                ? completionPercent
                : ringKind === "finger"
                    ? Math.min(100, Math.round(completionPercent * 0.78))
                    : ringKind === "repetitions"
                        ? completionPercent
                        : gloveState.sessionActive
                            ? Math.max(12, Math.min(100, Math.round(completionPercent * 0.6)))
                            : 0;
            applyProgressRing(ring, ringPercent);
        });
    }

    async function refreshNextExercise() {
        if (!nextExerciseDescription) {
            return;
        }

        try {
            const response = await fetch("api/patient/doctor_assignments.php");
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok || !payload?.plan) {
                throw new Error(payload?.error || "Unable to load plan");
            }

            const duration = Number(payload.plan.duration_min || 15);
            const targetReps = Number(payload.plan.target_repetitions || 0);
            const exerciseType = String(payload.plan.exercise_type || "Guided session");
            const repsCopy = targetReps ? `, ${targetReps} reps` : "";
            const hasPlan = duration > 0 || targetReps > 0;
            if (!hasPlan && payload.source === "default") {
                nextExerciseDescription.textContent = "No doctor plan yet — calibrate first to generate your first session.";
                return;
            }

            nextExerciseDescription.textContent = `${exerciseType} session${repsCopy}, estimated ${duration} minutes`;
        } catch {
            // Keep default copy if plan isn't available (e.g., not signed in yet).
        }
    }

    refreshDashboardVisuals();
    refreshNextExercise();
    window.addEventListener("storage", refreshDashboardVisuals);
    setInterval(refreshDashboardVisuals, 3000);
}

function initializeCharts() {
    if (typeof Chart === "undefined") {
        return;
    }

    const axisColor = document.body.classList.contains("dark-mode") ? "#88a8b4" : "#5e7f8d";
    const gridColor = document.body.classList.contains("dark-mode") ? "rgba(136,168,180,0.2)" : "rgba(94,127,141,0.15)";

    const strengthCanvas = document.getElementById("strengthChart");
    if (strengthCanvas) {
        new Chart(strengthCanvas, {
            type: "line",
            data: {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [{
                    label: "Force (N)",
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: "#0d5f73",
                    backgroundColor: "rgba(13,95,115,0.14)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                },
                scales: {
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: axisColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }

    const motionCanvas = document.getElementById("motionChart");
    if (motionCanvas) {
        new Chart(motionCanvas, {
            type: "bar",
            data: {
                labels: ["Index", "Middle", "Ring", "Little", "Thumb"],
                datasets: [
                    {
                        label: "Flexion (deg)",
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: "rgba(47,155,114,0.75)",
                        borderRadius: 8
                    },
                    {
                        label: "Extension (deg)",
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: "rgba(13,95,115,0.75)",
                        borderRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: axisColor }
                    }
                },
                scales: {
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: axisColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }
}

function initializeDoctorDashboard() {
    const doctorChartCanvas = document.getElementById("doctorWeeklyProgressChart");
    const totalPatientsEl = document.getElementById("dashboardTotalPatients");
    const activeTodayEl = document.getElementById("dashboardActivePatientsToday");
    const sessionsTodayEl = document.getElementById("dashboardSessionsToday");
    const avgGripEl = document.getElementById("dashboardAvgGripStrength");
    const alertsList = document.getElementById("dashboardAlertsList");
    const recentActivityBody = document.getElementById("dashboardRecentActivityBody");
    const quickOverviewBody = document.getElementById("dashboardQuickOverviewBody");
    const chartWrap = document.getElementById("doctorChartWrap");
    const metricButtons = document.querySelectorAll(".chart-metric-toggle .metric-btn");
    const quickActionButton = document.getElementById("dashboardQuickAction");
    const chartTitle = document.getElementById("doctorChartTitle");
    const chartSubtitle = document.getElementById("doctorChartSubtitle");
    const chartEmpty = document.getElementById("doctorChartEmpty");
    const patientSelectBtn = document.getElementById("patientSelectBtn");
    const patientSelectMenu = document.getElementById("patientSelectMenu");
    const patientSelectList = document.getElementById("patientSelectList");
    const patientSelectSearch = document.getElementById("patientSelectSearch");
    const selectedPatientLabel = document.getElementById("selectedPatientLabel");

    let doctorChart = null;
    let cachedPayload = null;
    let activeMetric = "grip";
    let selectedPatientKey = "all";
    let patientOptions = [];

    function safeText(value, fallback = "-") {
        const normalized = value === null || value === undefined ? "" : String(value).trim();
        return normalized || fallback;
    }

    function computeYAxisBounds(data) {
        const cleaned = data.filter(value => typeof value === "number" && !Number.isNaN(value));
        if (!cleaned.length) {
            return { min: 0, max: 1 };
        }
        const min = Math.min(...cleaned);
        const max = Math.max(...cleaned);
        const padding = Math.max(1, (max - min) * 0.1);
        return { min: Math.max(0, min - padding), max: max + padding };
    }

    function hasDataPoints(data) {
        return data.some(value => typeof value === "number" && value > 0);
    }

    function resolveSeries(chartData) {
        if (selectedPatientKey === "all") {
            return {
                labels: chartData?.labels,
                series: activeMetric === "range" ? chartData?.avgRange : chartData?.avgGrip
            };
        }

        const byPatient = chartData?.patients || chartData?.perPatient || {};
        const patientEntry = byPatient[selectedPatientKey] || null;
        if (!patientEntry) {
            return { labels: chartData?.labels, series: [] };
        }
        return {
            labels: patientEntry.labels || chartData?.labels,
            series: activeMetric === "range" ? patientEntry.range : patientEntry.grip
        };
    }

    function renderWeeklyChart(chartData) {
        if (!doctorChartCanvas || typeof Chart === "undefined") {
            return;
        }

        const axisColor = document.body.classList.contains("dark-mode") ? "#88a8b4" : "#5e7f8d";
        const gridColor = document.body.classList.contains("dark-mode") ? "rgba(136,168,180,0.2)" : "rgba(94,127,141,0.15)";

        if (doctorChart) {
            doctorChart.destroy();
        }

        const resolved = resolveSeries(chartData);
        const metricLabel = activeMetric === "range" ? "Range of Motion (deg)" : "Grip Strength (N)";
        const metricData = Array.isArray(resolved.series) ? resolved.series : [];
        const hasData = hasDataPoints(metricData);
        if (chartEmpty) {
            chartEmpty.hidden = hasData;
        }
        const yBounds = computeYAxisBounds(metricData);

        doctorChart = new Chart(doctorChartCanvas, {
            type: "line",
            data: {
                labels: Array.isArray(resolved.labels) ? resolved.labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [
                    {
                        label: metricLabel,
                        data: metricData.length ? metricData : [0, 0, 0, 0, 0, 0, 0],
                        borderColor: "#0d5f73",
                        backgroundColor: "rgba(13,95,115,0.14)",
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: axisColor } }
                },
                scales: {
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: {
                        beginAtZero: false,
                        min: yBounds.min,
                        max: yBounds.max,
                        ticks: { color: axisColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }

    function setTrend(elId, delta) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = "";
        if (delta === undefined || delta === null) return;
        const num = Number(delta);
        if (Number.isNaN(num)) return;
        const up = num >= 0;
        const arrow = document.createElement("i");
        arrow.className = `fa-solid fa-arrow-${up ? "up" : "down"}`;
        el.classList.toggle("up", up);
        el.classList.toggle("down", !up);
        el.appendChild(arrow);
        const text = document.createElement("span");
        text.textContent = `${Math.abs(Math.round(num))}%`;
        el.appendChild(text);
    }

    function applyUnreadBadge(unreadCount) {
        const messagesNav = document.querySelector('.menu li[data-page="messages.html"]');
        if (!messagesNav) return;
        if (unreadCount > 0) {
            messagesNav.classList.add("has-unread");
        } else {
            messagesNav.classList.remove("has-unread");
        }
    }

    function renderPatientSelector() {
        if (!patientSelectList) return;
        const query = (patientSelectSearch?.value || "").trim().toLowerCase();
        const filtered = patientOptions.filter(option => option.label.toLowerCase().includes(query));
        patientSelectList.innerHTML = filtered.map(option => {
            const active = option.key === selectedPatientKey ? "active" : "";
            return `<li class="selector-item ${active}" data-key="${option.key}">${option.label}</li>`;
        }).join("");
    }

    function updateChartTitle() {
        const activeLabel = patientOptions.find(item => item.key === selectedPatientKey)?.label || "All Patients (Avg)";
        if (chartSubtitle) {
            chartSubtitle.textContent = `Weekly Progress: ${activeLabel}`;
        }
    }

    function renderDashboard(payload) {
        cachedPayload = payload;
        const summary = payload.summary || {};
        if (totalPatientsEl) totalPatientsEl.textContent = String(summary.totalPatients ?? 0);
        if (activeTodayEl) activeTodayEl.textContent = String(summary.activePatientsToday ?? 0);
        if (sessionsTodayEl) sessionsTodayEl.textContent = String(summary.sessionsToday ?? 0);
        if (avgGripEl) avgGripEl.textContent = `${Number(summary.avgGripStrength ?? 0).toFixed(1)} N`;

        if (alertsList) {
            const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
            alertsList.innerHTML = alerts.length
                ? alerts.map(alert => {
                    const lower = String(alert).toLowerCase();
                    const isCritical = lower.includes("decreased") || lower.includes("drop") || lower.includes("critical");
                    return `<li class="${isCritical ? "alert-critical" : ""}"><span class="doctor-alert-icon" aria-hidden="true">i</span> ${safeText(alert)}</li>`;
                }).join("")
                : '<li><span class="doctor-alert-icon" aria-hidden="true">i</span> No patient alerts yet.</li>';
        }

        if (recentActivityBody) {
            const rows = Array.isArray(payload.recentActivity) ? payload.recentActivity : [];
            recentActivityBody.innerHTML = rows.length
                ? rows.map(row => `
                    <tr>
                        <td>${safeText(row.patient_name)}</td>
                        <td>${safeText(row.note, "Sensor reading recorded")}</td>
                        <td>${safeText(row.recorded_at, "-")}</td>
                    </tr>
                `).join("")
                : `
                    <tr class="empty-state-row">
                        <td colspan="3" class="empty-state">
                            <div class="empty-illustration">🩺</div>
                            <div>No recent patient activity yet.</div>
                        </td>
                    </tr>
                `;
        }

        if (quickOverviewBody) {
            const rows = Array.isArray(payload.quickOverview) ? payload.quickOverview : [];
            if (!patientOptions.length) {
                patientOptions = [
                    { key: "all", label: "All Patients (Avg)" },
                    ...rows.map(row => ({ key: row.id || row.name, label: row.name }))
                ];
                renderPatientSelector();
            }
            quickOverviewBody.innerHTML = rows.length
                ? rows.map(row => {
                    const drop = Number(row.drop_percent || row.drop || 0);
                    const missed = !!row.missed_session;
                    let trafficClass = "traffic-green";
                    if (!Number.isNaN(drop) && drop >= 20) {
                        trafficClass = "traffic-red";
                    } else if (missed) {
                        trafficClass = "traffic-yellow";
                    }
                    return `
                        <tr>
                            <td>${safeText(row.name)}</td>
                            <td><span class="status-traffic"><span class="traffic-dot ${trafficClass}" aria-hidden="true"></span>${safeText(row.status, "Stable")}</span></td>
                            <td>${safeText(row.last_session, "N/A")}</td>
                        </tr>
                    `;
                }).join("")
                : `
                    <tr class="empty-state-row">
                        <td colspan="3" class="empty-state">
                            <div class="empty-illustration">👥</div>
                            <div>No patients added yet.</div>
                            <div><a href="patients.html" class="btn btn-primary add-patient-cta">Add Patient</a></div>
                        </td>
                    </tr>
                `;
        }

        renderWeeklyChart(payload.weeklyChart || {});
    updateChartTitle();

        const trends = summary.trends || payload.trends || {};
        setTrend("trendTotalPatients", trends.totalPatients ?? summary.deltaTotalPatients);
        setTrend("trendActivePatients", trends.activePatientsToday ?? summary.deltaActivePatients);
        setTrend("trendSessionsToday", trends.sessionsToday ?? summary.deltaSessions);
        setTrend("trendAvgGrip", trends.avgGripStrength ?? summary.deltaAvgGrip);

        applyUnreadBadge(Number(payload.unreadMessages ?? payload.unreadMessagesCount ?? 0));
    }

    metricButtons?.forEach(button => {
        button.addEventListener("click", () => {
            metricButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            activeMetric = button.dataset.metric || "grip";
            if (cachedPayload) {
                renderWeeklyChart(cachedPayload.weeklyChart || {});
            }
        });
    });

    patientSelectBtn?.addEventListener("click", () => {
        if (!patientSelectMenu) return;
        patientSelectMenu.hidden = !patientSelectMenu.hidden;
        if (!patientSelectMenu.hidden) {
            patientSelectSearch?.focus();
        }
    });

    document.addEventListener("click", event => {
        if (!patientSelectMenu || !patientSelectBtn) return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target) return;
        if (patientSelectMenu.contains(target) || patientSelectBtn.contains(target)) return;
        patientSelectMenu.hidden = true;
    });

    patientSelectSearch?.addEventListener("input", renderPatientSelector);

    patientSelectList?.addEventListener("click", event => {
        const target = event.target instanceof HTMLElement ? event.target.closest(".selector-item") : null;
        if (!target) return;
        const key = target.getAttribute("data-key");
        if (!key) return;
        selectedPatientKey = key;
        const activeLabel = patientOptions.find(item => item.key === key)?.label || "All Patients (Avg)";
        if (selectedPatientLabel) {
            selectedPatientLabel.textContent = activeLabel;
        }
        renderPatientSelector();
        updateChartTitle();
        if (cachedPayload) {
            renderWeeklyChart(cachedPayload.weeklyChart || {});
        }
        if (patientSelectMenu) patientSelectMenu.hidden = true;
    });

    quickActionButton?.addEventListener("click", () => {
        window.location.href = "patients.html";
    });

    if (chartWrap) chartWrap.classList.add("is-loading");

    fetch("api/doctor/dashboard.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load dashboard data.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load dashboard data.");
            }

            renderDashboard(payload);
            if (chartWrap) chartWrap.classList.remove("is-loading");
        })
        .catch(() => {
            if (alertsList) {
                alertsList.innerHTML = '<li><span class="doctor-alert-icon" aria-hidden="true">i</span> Unable to load dashboard data right now.</li>';
            }
            if (chartWrap) chartWrap.classList.remove("is-loading");
        });
}

function initializePatientsPage() {
    const pageRoot = document.getElementById("patientsPageRoot");
    if (!pageRoot) {
        return;
    }

    const listView = document.getElementById("patientListView");
    const profileView = document.getElementById("patientProfileView");
    const backToListButton = document.getElementById("backToPatientList");
    const tableBody = document.getElementById("patientTableBody");
    const searchInput = document.getElementById("patientSearchInput");
    const statusFilter = document.getElementById("patientStatusFilter");
    const openModalButton = document.getElementById("openAddPatientModal");
    const closeModalButton = document.getElementById("closeAddPatientModal");
    const modal = document.getElementById("addPatientModal");
    const modalBackdrop = document.getElementById("addPatientModalBackdrop");
    const addPatientForm = document.getElementById("addPatientForm");
    const saveNotesButton = document.getElementById("saveDoctorNotes");
    const notesInput = document.getElementById("doctorNotesInput");
    const notesFeedback = document.getElementById("notesSaveFeedback");
    const clinicalDiagnosisInput = document.getElementById("clinicalDiagnosis");
    const clinicalTreatmentGoalInput = document.getElementById("clinicalTreatmentGoal");
    const clinicalAssignedDoctorInput = document.getElementById("clinicalAssignedDoctor");
    const clinicalLastReviewInput = document.getElementById("clinicalLastReview");
    const saveClinicalInfoButton = document.getElementById("saveClinicalInfo");
    const clinicalSaveFeedback = document.getElementById("clinicalSaveFeedback");

    const profileName = document.getElementById("profilePatientName");
    const profileBreadcrumbName = document.getElementById("patientProfileBreadcrumbName");
    const profileAge = document.getElementById("profilePatientAge");
    const profileStrokeType = document.getElementById("profileStrokeType");
    const profileAffectedHand = document.getElementById("profileAffectedHand");
    const profileGrip = document.getElementById("profileGrip");
    const profileFlexion = document.getElementById("profileFlexion");
    const profileRepetitions = document.getElementById("profileRepetitions");
    const planDuration = document.getElementById("planDuration");
    const planRepetitions = document.getElementById("planRepetitions");
    const planSessions = document.getElementById("planSessions");

    let patients = [];
    let activePatientId = "";
    let gripChartInstance = null;
    let flexionChartInstance = null;

    // Load patients from the API.
    fetch('api/patients/list.php')
        .then(response => response.ok ? response.json() : null)
        .then(data => {
            if (!Array.isArray(data)) {
                patients = [];
                activePatientId = "";
                renderPatientTable();
                return;
            }

            patients = data.map(row => ({
                id: `db-${row.id}`,
                dbId: row.id,
                name: row.name,
                age: row.age,
                strokeType: row.stroke_type || 'Unknown',
                strokeSide: row.affected_hand || 'Unknown',
                affectedHand: row.affected_hand || 'Unknown',
                lastSession: row.last_session || 'N/A',
                status: row.status || 'Stable',
                isActiveToday: false,
                metrics: { grip: '0 N', flexion: '0 deg', repetitionsToday: '0' },
                therapyPlan: { duration: 20, repetitions: 120, sessionsPerDay: 2 },
                notes: '',
                chart: { grip: [0, 0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0, 0] }
            }));
            activePatientId = patients[0]?.id || '';
            renderPatientTable();
        })
        .catch(() => {
            patients = [];
            activePatientId = "";
            renderPatientTable();
        });

    function getStatusPill(status) {
        if (status === "Improving") {
            return "status-improving";
        }
        if (status === "Needs Attention") {
            return "status-attention";
        }
        return "status-stable";
    }

    function getFilteredPatients() {
        const searchText = (searchInput?.value || "").trim().toLowerCase();
        const selectedStatus = statusFilter?.value || "all";

        return patients.filter(patient => {
            const matchesSearch = patient.name.toLowerCase().includes(searchText);
            let matchesFilter = true;

            if (selectedStatus === "Active Today") {
                matchesFilter = patient.isActiveToday;
            } else if (selectedStatus !== "all") {
                matchesFilter = patient.status === selectedStatus;
            }

            return matchesSearch && matchesFilter;
        });
    }

    function renderPatientTable() {
        if (!tableBody) {
            return;
        }

        const filteredPatients = getFilteredPatients();

        tableBody.innerHTML = "";
        if (!filteredPatients.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">No patients match your search/filter.</td>
                </tr>
            `;
            return;
        }

        filteredPatients.forEach(patient => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${patient.name}</td>
                <td>${patient.age}</td>
                <td>${patient.strokeSide}</td>
                <td>${patient.lastSession}</td>
                <td><span class="status-pill ${getStatusPill(patient.status)}">${patient.status}</span></td>
                <td><button type="button" class="table-view-btn" data-patient-id="${patient.id}">View</button></td>
            `;
            tableBody.appendChild(row);
        });
    }

    function destroyProfileCharts() {
        if (gripChartInstance) {
            gripChartInstance.destroy();
            gripChartInstance = null;
        }

        if (flexionChartInstance) {
            flexionChartInstance.destroy();
            flexionChartInstance = null;
        }
    }

    function renderProfileCharts(patient) {
        if (typeof Chart === "undefined") {
            return;
        }

        const gripCanvas = document.getElementById("patientGripProgressChart");
        const flexionCanvas = document.getElementById("patientFlexionProgressChart");
        if (!gripCanvas || !flexionCanvas) {
            return;
        }

        destroyProfileCharts();

        const axisColor = document.body.classList.contains("dark-mode") ? "#88a8b4" : "#5e7f8d";
        const gridColor = document.body.classList.contains("dark-mode") ? "rgba(136,168,180,0.2)" : "rgba(94,127,141,0.15)";

        gripChartInstance = new Chart(gripCanvas, {
            type: "line",
            data: {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [
                    {
                        label: "Force (N)",
                        data: patient.chart.grip,
                        borderColor: "#0d5f73",
                        backgroundColor: "rgba(13,95,115,0.14)",
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: { beginAtZero: true, ticks: { color: axisColor }, grid: { color: gridColor } }
                }
            }
        });

        flexionChartInstance = new Chart(flexionCanvas, {
            type: "bar",
            data: {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [
                    {
                        label: "Flexion (deg)",
                        data: patient.chart.flexion,
                        backgroundColor: "rgba(47,155,114,0.75)",
                        borderRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: axisColor }
                    }
                },
                scales: {
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: { beginAtZero: true, ticks: { color: axisColor }, grid: { color: gridColor } }
                }
            }
        });
    }

    function setProfilePatient(patientId) {
        const patient = patients.find(entry => entry.id === patientId);
        if (!patient) {
            return;
        }

        activePatientId = patient.id;

        if (profileName) {
            profileName.textContent = patient.name;
        }
        if (profileBreadcrumbName) {
            profileBreadcrumbName.textContent = patient.name;
        }
        if (profileAge) {
            profileAge.textContent = String(patient.age);
        }
        if (profileStrokeType) {
            profileStrokeType.textContent = patient.strokeType;
        }
        if (profileAffectedHand) {
            profileAffectedHand.textContent = patient.affectedHand;
        }
        if (profileGrip) {
            profileGrip.textContent = patient.metrics.grip;
        }
        if (profileFlexion) {
            profileFlexion.textContent = patient.metrics.flexion;
        }
        if (profileRepetitions) {
            profileRepetitions.textContent = patient.metrics.repetitionsToday;
        }
        if (planDuration) {
            planDuration.value = String(patient.therapyPlan.duration);
        }
        if (planRepetitions) {
            planRepetitions.value = String(patient.therapyPlan.repetitions);
        }
        if (planSessions) {
            planSessions.value = String(patient.therapyPlan.sessionsPerDay);
        }
        if (notesInput) {
            notesInput.value = patient.notes || "";
        }
        if (notesFeedback) {
            notesFeedback.textContent = "";
        }

        if (clinicalSaveFeedback) {
            clinicalSaveFeedback.textContent = "";
        }
        void loadClinicalData(patient.dbId || patient.id);

        renderProfileCharts(patient);
    }

    async function loadClinicalData(patientDbId) {
        if (!clinicalDiagnosisInput && !clinicalTreatmentGoalInput && !notesInput) {
            return;
        }

        try {
            const response = await fetch(`api/patients/clinical.php?patientId=${patientDbId}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || "Unable to load clinical data.");
            }

            const clinical = payload.clinical || {};
            if (clinicalDiagnosisInput) clinicalDiagnosisInput.value = clinical.diagnosis || "";
            if (clinicalTreatmentGoalInput) clinicalTreatmentGoalInput.value = clinical.treatment_goal || "";
            if (clinicalAssignedDoctorInput) clinicalAssignedDoctorInput.value = clinical.assigned_doctor || "";
            if (clinicalLastReviewInput) clinicalLastReviewInput.value = clinical.reviewed_at || "";
            if (notesInput) notesInput.value = clinical.treatment_goal || notesInput.value;
        } catch (err) {
            if (clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = "Unable to load medical info.";
            }
        }
    }

    async function saveClinicalData(patientDbId, { diagnosis, treatmentGoal }) {
        if (!patientDbId) return false;
        if (clinicalSaveFeedback) {
            clinicalSaveFeedback.textContent = "Saving medical info...";
        }
        try {
            const response = await fetch("api/patients/clinical.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patientDbId,
                    diagnosis,
                    treatmentGoal
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || "Unable to save medical info.");
            }

            if (clinicalLastReviewInput) {
                clinicalLastReviewInput.value = payload.reviewed_at || "";
            }
            if (clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = "Medical info saved.";
            }
            return true;
        } catch (err) {
            if (clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = err instanceof Error ? err.message : "Unable to save medical info.";
            }
            return false;
        }
    }

    function showProfileView(patientId) {
        setProfilePatient(patientId);
        if (listView) {
            listView.classList.add("is-hidden");
        }
        if (profileView) {
            profileView.classList.remove("is-hidden");
        }
    }

    function showListView() {
        if (profileView) {
            profileView.classList.add("is-hidden");
        }
        if (listView) {
            listView.classList.remove("is-hidden");
        }
    }

    function openModal() {
        if (!modal) {
            return;
        }

        modal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        if (!modal) {
            return;
        }

        modal.hidden = true;
        document.body.style.overflow = "";
        if (addPatientForm) {
            addPatientForm.reset();
        }
    }

    async function addPatientFromForm(form) {
        const formData = new FormData(form);
        const patientName = String(formData.get("name") || "").trim();
        const ageDob      = String(formData.get("ageDob") || "").trim();
        const gender      = String(formData.get("gender") || "").trim();
        const strokeType  = String(formData.get("strokeType") || "").trim();
        const affectedHand = String(formData.get("affectedHand") || "").trim();
        const contact     = String(formData.get("contact") || "").trim();
        const username    = String(formData.get("username") || "").trim();
        const password    = String(formData.get("password") || "");

        const parsedAge = Number.parseInt(ageDob, 10);
        const age = Number.isNaN(parsedAge) ? 0 : parsedAge;

        try {
            const response = await fetch('api/patients/create.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: patientName, age, gender, strokeType, affectedHand, contact, username, password })
            });
            const result = await response.json();
            if (response.ok && result.ok) {
                const patient = {
                    id: `db-${result.id}`,
                    dbId: result.id,
                    name: patientName,
                    age,
                    strokeType,
                    strokeSide: affectedHand === "Left" ? "Left" : "Right",
                    affectedHand,
                    lastSession: "N/A",
                    status: "Stable",
                    isActiveToday: false,
                    metrics: { grip: "0 N", flexion: "0 deg", repetitionsToday: "0" },
                    therapyPlan: { duration: 0, repetitions: 0, sessionsPerDay: 0 },
                    notes: "",
                    chart: { grip: [0, 0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0, 0] }
                };

                patients = [patient, ...patients];
                activePatientId = patient.id;
                renderPatientTable();
                closeModal();
            } else {
                alert(result.error || 'Could not save patient to database.');
            }
        } catch (_err) {
            alert('Database connection error. Patient was not created.');
        }
    }

    tableBody?.addEventListener("click", event => {
        const targetButton = event.target instanceof HTMLElement ? event.target.closest(".table-view-btn") : null;
        if (!targetButton) {
            return;
        }

        const patientId = targetButton.getAttribute("data-patient-id");
        if (patientId) {
            showProfileView(patientId);
        }
    });

    backToListButton?.addEventListener("click", showListView);

    searchInput?.addEventListener("input", renderPatientTable);
    statusFilter?.addEventListener("change", renderPatientTable);

    openModalButton?.addEventListener("click", openModal);
    closeModalButton?.addEventListener("click", closeModal);
    modalBackdrop?.addEventListener("click", closeModal);

    addPatientForm?.addEventListener("submit", event => {
        event.preventDefault();
        if (!(event.currentTarget instanceof HTMLFormElement)) {
            return;
        }

        if (!event.currentTarget.checkValidity()) {
            event.currentTarget.reportValidity();
            return;
        }

        void addPatientFromForm(event.currentTarget);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal && !modal.hidden) {
            closeModal();
        }
    });

    saveNotesButton?.addEventListener("click", async () => {
        const patient = patients.find(entry => entry.id === activePatientId);
        if (!patient || !notesInput) {
            return;
        }

        patient.notes = notesInput.value.trim();
        const diagnosis = clinicalDiagnosisInput?.value.trim() || "";
        const saved = await saveClinicalData(patient.dbId || patient.id, {
            diagnosis,
            treatmentGoal: patient.notes
        });

        if (notesFeedback) {
            notesFeedback.textContent = saved ? "Notes saved." : "Unable to save notes.";
        }
    });

    saveClinicalInfoButton?.addEventListener("click", async () => {
        const patient = patients.find(entry => entry.id === activePatientId);
        if (!patient) {
            return;
        }

        const diagnosis = clinicalDiagnosisInput?.value.trim() || "";
        const treatmentGoal = clinicalTreatmentGoalInput?.value.trim() || "";
        const saved = await saveClinicalData(patient.dbId || patient.id, { diagnosis, treatmentGoal });
        if (saved && notesInput) {
            notesInput.value = treatmentGoal;
        }
    });

    [planDuration, planRepetitions, planSessions].forEach(input => {
        input?.addEventListener("change", () => {
            const patient = patients.find(entry => entry.id === activePatientId);
            if (!patient) {
                return;
            }

            patient.therapyPlan.duration = Number(planDuration?.value || patient.therapyPlan.duration);
            patient.therapyPlan.repetitions = Number(planRepetitions?.value || patient.therapyPlan.repetitions);
            patient.therapyPlan.sessionsPerDay = Number(planSessions?.value || patient.therapyPlan.sessionsPerDay);
        });
    });

    renderPatientTable();
}

function initializeTherapyPlansPage() {
    const pageRoot = document.getElementById("therapyPlansRoot");
    if (!pageRoot) {
        return;
    }

    const assignmentsBody = document.getElementById("therapyAssignmentsBody");
    const assignPatientSelect = document.getElementById("assignPatientSelect");
    const assignTemplateSelect = document.getElementById("assignTemplateSelect");
    const applyTemplateBtn = document.getElementById("applyTemplateBtn");
    const assignFeedback = document.getElementById("assignTemplateFeedback");
    const editPopup = document.getElementById("therapyEditPopup");
    const editBackdrop = document.getElementById("therapyEditBackdrop");
    const editDurationInput = document.getElementById("editDurationInput");
    const editRepetitionsInput = document.getElementById("editRepetitionsInput");
    const editSessionsInput = document.getElementById("editSessionsInput");
    const cancelEditBtn = document.getElementById("cancelEditPlanBtn");
    const saveEditBtn = document.getElementById("saveEditPlanBtn");

    const templates = {
        level1: { label: "Level 1: Beginner", duration: 15, repetitions: 30, sessionsPerDay: 2 },
        level2: { label: "Level 2: Intermediate", duration: 20, repetitions: 40, sessionsPerDay: 3 },
        level3: { label: "Level 3: Advanced", duration: 25, repetitions: 55, sessionsPerDay: 3 }
    };

    let assignments = [];

    let editingAssignmentId = "";

    function templateKeyByLabel(label) {
        const normalized = String(label || "").toLowerCase();
        if (normalized.includes("beginner") || normalized === "level1") {
            return "level1";
        }
        if (normalized.includes("intermediate") || normalized === "level2") {
            return "level2";
        }
        if (normalized.includes("advanced") || normalized === "level3") {
            return "level3";
        }
        return "custom";
    }

    function populatePatientSelect() {
        if (!assignPatientSelect) {
            return;
        }

        assignPatientSelect.innerHTML = assignments.length
            ? assignments.map(assignment => `<option value="${assignment.id}">${assignment.patientName}</option>`).join("")
            : "<option value=\"\">No patients</option>";
    }

    function renderAssignments() {
        if (!assignmentsBody) {
            return;
        }

        assignmentsBody.innerHTML = assignments.length
            ? assignments.map(assignment => `
                <tr>
                    <td>${assignment.patientName}</td>
                    <td>${assignment.label || "Default"}</td>
                    <td>${assignment.duration} min</td>
                    <td>${assignment.repetitions}</td>
                    <td>${assignment.sessionsPerDay}</td>
                    <td><button type="button" class="therapy-edit-btn" data-assignment-id="${assignment.id}">Edit</button></td>
                </tr>
            `).join("")
            : '<tr><td colspan="6">No patients added yet.</td></tr>';
    }

    function loadAssignments() {
        fetch("api/doctor/therapy_plans.php")
            .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load therapy plans.")))
            .then(payload => {
                if (!payload?.ok) {
                    throw new Error(payload?.error || "Unable to load therapy plans.");
                }

                assignments = (payload.assignments || []).map(row => ({
                    id: String(row.patient_id),
                    patientId: Number(row.patient_id),
                    patientName: String(row.patient_name || "Patient"),
                    templateId: templateKeyByLabel(row.template_name),
                    label: row.template_name || "Default",
                    duration: Number(row.duration_min || 0),
                    repetitions: Number(row.target_repetitions || 0),
                    sessionsPerDay: Number(row.sessions_per_day || 0)
                }));

                populatePatientSelect();
                renderAssignments();
            })
            .catch(() => {
                assignments = [];
                populatePatientSelect();
                renderAssignments();
                if (assignFeedback) {
                    assignFeedback.textContent = "Unable to load therapy plans right now.";
                }
            });
    }

    function openEditPopup(assignmentId) {
        const assignment = assignments.find(item => item.id === assignmentId);
        if (!assignment || !editPopup || !editDurationInput || !editRepetitionsInput || !editSessionsInput) {
            return;
        }

        editingAssignmentId = assignment.id;
        editDurationInput.value = String(assignment.duration);
        editRepetitionsInput.value = String(assignment.repetitions);
        editSessionsInput.value = String(assignment.sessionsPerDay);
        editPopup.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeEditPopup() {
        if (!editPopup) {
            return;
        }

        editPopup.hidden = true;
        document.body.style.overflow = "";
        editingAssignmentId = "";
    }

    assignmentsBody?.addEventListener("click", event => {
        const editButton = event.target instanceof HTMLElement ? event.target.closest(".therapy-edit-btn") : null;
        if (!editButton) {
            return;
        }

        const assignmentId = editButton.getAttribute("data-assignment-id");
        if (assignmentId) {
            openEditPopup(assignmentId);
        }
    });

    applyTemplateBtn?.addEventListener("click", () => {
        if (!assignPatientSelect || !assignTemplateSelect) {
            return;
        }

        const selectedPatientId = assignPatientSelect.value;
        const selectedTemplateId = assignTemplateSelect.value;
        const selectedTemplate = templates[selectedTemplateId];
        if (!selectedTemplate) {
            return;
        }

        assignments = assignments.map(assignment => {
            if (assignment.id !== selectedPatientId) {
                return assignment;
            }
            return {
                ...assignment,
                templateId: selectedTemplateId,
                ...selectedTemplate
            };
        });

        renderAssignments();

        const active = assignments.find(item => item.id === selectedPatientId);
        if (active) {
            void fetch("api/doctor/therapy_plans.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: active.patientId,
                    templateName: selectedTemplate.label,
                    durationMin: active.duration,
                    targetRepetitions: active.repetitions,
                    sessionsPerDay: active.sessionsPerDay
                })
            });
        }

        if (assignFeedback) {
            const name = assignments.find(item => item.id === selectedPatientId)?.patientName || "Patient";
            assignFeedback.textContent = `${selectedTemplate.label} assigned to ${name}.`;
        }
    });

    saveEditBtn?.addEventListener("click", () => {
        const nextDuration = Number(editDurationInput?.value || 0);
        const nextRepetitions = Number(editRepetitionsInput?.value || 0);
        const nextSessions = Number(editSessionsInput?.value || 0);

        if (nextDuration < 1 || nextRepetitions < 1 || nextSessions < 1) {
            return;
        }

        assignments = assignments.map(assignment => {
            if (assignment.id !== editingAssignmentId) {
                return assignment;
            }

            return {
                ...assignment,
                duration: nextDuration,
                repetitions: nextRepetitions,
                sessionsPerDay: nextSessions,
                label: "Custom"
            };
        });

        renderAssignments();

        const active = assignments.find(item => item.id === editingAssignmentId);
        if (active) {
            void fetch("api/doctor/therapy_plans.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: active.patientId,
                    templateName: active.label,
                    durationMin: active.duration,
                    targetRepetitions: active.repetitions,
                    sessionsPerDay: active.sessionsPerDay
                })
            });
        }

        closeEditPopup();
    });

    cancelEditBtn?.addEventListener("click", closeEditPopup);
    editBackdrop?.addEventListener("click", closeEditPopup);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && editPopup && !editPopup.hidden) {
            closeEditPopup();
        }
    });

    loadAssignments();
}

function initializeGlobalProgressPage() {
    const pageRoot = document.getElementById("globalProgressRoot");
    if (!pageRoot) {
        return;
    }

    const leaderboardList = document.getElementById("progressLeaderboardList");
    const heatmapGrid = document.getElementById("clinicHeatmapGrid");
    const downloadButton = document.getElementById("downloadMonthlyReportBtn");

    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let weeklySessions = [0, 0, 0, 0, 0, 0, 0];
    let leaderboard = [];
    let patientsProgressData = [];

    const chartCanvas = document.getElementById("globalProgressComparisonChart");
    let progressChart = null;

    function renderChart() {
        if (!chartCanvas || typeof Chart === "undefined") {
            return;
        }

        const axisColor = document.body.classList.contains("dark-mode") ? "#88a8b4" : "#5e7f8d";
        const gridColor = document.body.classList.contains("dark-mode") ? "rgba(136,168,180,0.2)" : "rgba(94,127,141,0.15)";
        const palette = ["#0d5f73", "#2f9b72", "#4d869c", "#3f7a90", "#6aa5b8"];

        if (progressChart) {
            progressChart.destroy();
        }

        const datasets = patientsProgressData
            .filter(patient => patient.hasData)
            .map((patient, index) => ({
                label: patient.name,
                data: patient.grip,
                borderColor: palette[index % palette.length],
                backgroundColor: "transparent",
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 3
            }));

        progressChart = new Chart(chartCanvas, {
            type: "line",
            data: {
                labels: dayLabels,
                datasets: datasets.length ? datasets : [{
                    label: "No data recorded yet",
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: "#9ab4bf",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: axisColor }
                    }
                },
                scales: {
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    y: { beginAtZero: true, ticks: { color: axisColor }, grid: { color: gridColor } }
                }
            }
        });
    }

    function renderLeaderboard() {
        if (!leaderboardList) {
            return;
        }

        if (!leaderboard.length) {
            leaderboardList.innerHTML = "<li>No data recorded yet.</li>";
            return;
        }

        leaderboardList.innerHTML = leaderboard
            .map((entry, index) => `<li>${index + 1}. ${entry.name} - ${Number(entry.score || 0).toFixed(1)}% weekly improvement</li>`)
            .join("");
    }

    function renderHeatmap() {
        if (!heatmapGrid) {
            return;
        }

        const maxSessions = Math.max(...weeklySessions, 0);
        heatmapGrid.innerHTML = dayLabels
            .map((day, index) => {
                const value = weeklySessions[index] || 0;
                const intensity = maxSessions ? value / maxSessions : 0;
                const lightness = 92 - intensity * 48;
                const bgColor = `hsl(194, 36%, ${lightness}%)`;

                return `
                    <div class="heatmap-day" style="background:${bgColor}">
                        <span>${day}</span>
                        <strong>${value}</strong>
                        <span>sessions</span>
                    </div>
                `;
            })
            .join("");
    }

    fetch("api/doctor/progress.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load progress data.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load progress data.");
            }

            patientsProgressData = Array.isArray(payload.datasets) ? payload.datasets : [];
            leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];

            const labels = Array.isArray(payload.labels) ? payload.labels : dayLabels;
            const heatmap = payload.heatmap || {};
            weeklySessions = labels.map(label => Number(heatmap[label] || 0));

            renderChart();
            renderLeaderboard();
            renderHeatmap();
        })
        .catch(() => {
            patientsProgressData = [];
            leaderboard = [];
            weeklySessions = [0, 0, 0, 0, 0, 0, 0];
            renderChart();
            renderLeaderboard();
            renderHeatmap();
        });

    downloadButton?.addEventListener("click", () => {
        const totalSessions = weeklySessions.reduce((sum, value) => sum + value, 0);
        const topLine = leaderboard[0] ? `${leaderboard[0].name} (${leaderboard[0].score.toFixed(1)}%)` : "N/A";
        const report = [
            "Theraflow Monthly Progress Summary",
            "Generated: March 2026",
            "",
            `Total Weekly Sessions Recorded: ${totalSessions}`,
            `Top Recovering Patient: ${topLine}`,
            "",
            "Leaderboard:",
            ...leaderboard.map((entry, index) => `${index + 1}. ${entry.name} - ${entry.score.toFixed(1)}%`),
            "",
            "Daily Sessions:",
            ...dayLabels.map((day, index) => `${day}: ${weeklySessions[index]}`)
        ].join("\n");

        const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = "theraflow-monthly-report-march-2026.txt";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
    });
}

function initializeMessagesPage() {
    const pageRoot = document.getElementById("messagesPageRoot");
    if (!pageRoot) {
        return;
    }

    const searchInput = document.getElementById("messageSearchInput");
    const patientList = document.getElementById("messagePatientList");
    const thread = document.getElementById("messageThread");
    const composeInput = document.getElementById("messageComposeInput");
    const sendButton = document.getElementById("sendMessageBtn");
    const quickTemplateButtons = document.querySelectorAll(".quick-template-btn");
    const activeName = document.getElementById("activeConversationName");
    const activeMeta = document.getElementById("activeConversationMeta");
    const navDot = document.getElementById("messagesNavDot");

    let conversations = [];
    let activeConversationId = "";

    function updateSidebarUnreadDot() {
        const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unread, 0);
        if (navDot) {
            navDot.hidden = totalUnread === 0;
        }
    }

    function getActiveConversation() {
        return conversations.find(item => item.id === activeConversationId) || null;
    }

    function renderPatientList() {
        if (!patientList) {
            return;
        }

        const query = (searchInput?.value || "").trim().toLowerCase();
        const filteredConversations = conversations.filter(conversation =>
            conversation.name.toLowerCase().includes(query)
        );

        patientList.innerHTML = filteredConversations
            .map(conversation => `
                <li>
                    <button type="button" class="messages-patient-item ${conversation.id === activeConversationId ? "active" : ""}" data-conversation-id="${conversation.id}">
                        <span class="messages-patient-name">${conversation.name}</span>
                        ${conversation.unread > 0 ? `<span class="messages-unread-badge">${conversation.unread}</span>` : ""}
                    </button>
                </li>
            `)
            .join("");
    }

    function renderThread() {
        if (!thread || !activeName || !activeMeta) {
            return;
        }

        const conversation = getActiveConversation();
        if (!conversation) {
            activeName.textContent = "Select a patient";
            activeMeta.textContent = "No active conversation selected.";
            thread.innerHTML = "";
            return;
        }

        activeName.textContent = conversation.name;
        activeMeta.textContent = conversation.unread > 0 ? `${conversation.unread} unread message(s)` : "All messages read";

        thread.innerHTML = conversation.messages
            .map(message => `<div class="message-bubble ${message.from}">${message.text}</div>`)
            .join("");
        thread.scrollTop = thread.scrollHeight;
    }

    function setActiveConversation(conversationId) {
        activeConversationId = conversationId;
        const activeConversation = getActiveConversation();
        if (activeConversation) {
            activeConversation.unread = 0;
        }

        renderPatientList();
        renderThread();
        updateSidebarUnreadDot();
    }

    function sendMessage(text) {
        const messageText = text.trim();
        if (!messageText) {
            return;
        }

        const conversation = getActiveConversation();
        if (!conversation) {
            return;
        }

        const patientId = Number(conversation.patientId || 0);
        if (!patientId) {
            return;
        }

        fetch("api/doctor/messages.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, body: messageText })
        })
            .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to send message.")))
            .then(payload => {
                if (!payload?.ok) {
                    throw new Error(payload?.error || "Unable to send message.");
                }

                conversation.messages.push({ from: "doctor", text: messageText });
                renderThread();
                if (composeInput) {
                    composeInput.value = "";
                    composeInput.focus();
                }
            })
            .catch(() => {
                activeMeta && (activeMeta.textContent = "Failed to send message. Please try again.");
            });
    }

    patientList?.addEventListener("click", event => {
        const targetButton = event.target instanceof HTMLElement ? event.target.closest(".messages-patient-item") : null;
        if (!targetButton) {
            return;
        }

        const conversationId = targetButton.getAttribute("data-conversation-id");
        if (conversationId) {
            setActiveConversation(conversationId);
        }
    });

    searchInput?.addEventListener("input", renderPatientList);

    sendButton?.addEventListener("click", () => {
        if (!composeInput) {
            return;
        }
        sendMessage(composeInput.value);
    });

    composeInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage(composeInput.value);
        }
    });

    quickTemplateButtons.forEach(button => {
        button.addEventListener("click", () => {
            const message = button.getAttribute("data-template") || "";
            if (composeInput) {
                composeInput.value = message;
                composeInput.focus();
            }
        });
    });

    fetch("api/doctor/messages.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load conversations.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load conversations.");
            }

            conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
            activeConversationId = conversations[0]?.id || "";

            renderPatientList();
            if (activeConversationId) {
                setActiveConversation(activeConversationId);
            } else {
                renderThread();
                updateSidebarUnreadDot();
            }
        })
        .catch(() => {
            conversations = [];
            renderPatientList();
            renderThread();
            updateSidebarUnreadDot();
        });
}

function initializeExerciseHubPage() {
    const root = document.getElementById("exerciseHubRoot");
    if (!root) return;

    // ── Element references ────────────────────────────────────────────────────
    // Step nav dots and connector bars
    const navDots = [1, 2, 3, 4].map(n => document.getElementById(`navDot${n}`));
    const wizBars = [1, 2, 3].map(n => document.getElementById(`wizBar${n}`));

    // Step panels
    const stepPair     = document.getElementById("stepPair");
    const stepCalibrate = document.getElementById("stepCalibrate");
    const stepDiagnose  = document.getElementById("stepDiagnose");
    const stepSession   = document.getElementById("stepSession");

    // Step 1 — Pair
    const pairButton    = document.getElementById("hubPairButton");
    const pairStatus    = document.getElementById("hubPairStatus");
    const searchingAnim = document.getElementById("searchingAnimation");

    // Step 2 — Calibrate
    const calibrateBtn      = document.getElementById("hubCalibrateBtn");
    const calibrationGrid   = document.getElementById("calibrationFingerGrid");
    const calibrationStatus = document.getElementById("hubCalibrationStatus");
    const calibrationPrompt = document.getElementById("calibrationPrompt");

    // Step 3 — Mode Selection
    const diagStatus       = document.getElementById("hubDiagStatus");
    const therapyStartBtn  = document.getElementById("hubTherapyStartBtn");
    const testStartBtn     = document.getElementById("hubTestStartBtn");
    const therapyDurationEl = document.getElementById("hubTherapyDuration");
    const therapyRepsEl     = document.getElementById("hubTherapyReps");
    const therapyTypeEl     = document.getElementById("hubTherapyType");

    // Step 4 — Session
    const sessionIntro    = document.getElementById("hubSessionIntro");
    const targetRepsEl    = document.getElementById("hubTargetReps");
    const sessionRepsEl   = document.getElementById("hubSessionReps");
    const sessionForceEl  = document.getElementById("hubSessionForce");
    const sessionTimeEl   = document.getElementById("hubSessionTime");
    const startSessionBtn = document.getElementById("hubStartSessionBtn");
    const endSessionBtn   = document.getElementById("hubEndSessionBtn");
    const sessionStatus   = document.getElementById("hubSessionStatus");
    const therapySessionPane = document.getElementById("therapySessionPane");
    const testSessionPane    = document.getElementById("testSessionPane");
    const testPromptEl       = document.getElementById("hubTestPrompt");
    const testActionBtn      = document.getElementById("hubTestActionBtn");
    const testGripAvgEl      = document.getElementById("hubTestGripAvg");
    const testFlexAvgEl      = document.getElementById("hubTestFlexAvg");
    const testExtAvgEl       = document.getElementById("hubTestExtAvg");
    const testTrialCountEl   = document.getElementById("hubTestTrialCount");

    // ── State ─────────────────────────────────────────────────────────────────
    let gloveConnected = false;
    const fingerNames = ["Thumb", "Index", "Middle", "Ring", "Little"];
    const calibrationState = fingerNames.map(name => ({ name, zero: null, max: null }));
    const diagResults = { maxExtension: 0, maxFlexion: 0, peakForce: 0 };
    let planTargetReps = 120;
    let planDurationMin = 15;
    let planExerciseType = "Active Grip";
    let calibrationPhase = "zero";
    let calibrationComplete = false;
    let selectedMode = "";

    const sessionState = {
        isRunning: false,
        targetRepetitions: 120,
        reps: 0,
        totalForce: 0,
        sampleCount: 0,
        startTime: null,
        intervalId: null
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function setMsg(el, text) {
        if (el) el.textContent = text;
    }

    function pseudoRandom(min, max) {
        return Number((Math.random() * (max - min) + min).toFixed(1));
    }

    async function readGloveValue(min, max) {
        return pseudoRandom(min, max);
    }

    // ── Step navigation ───────────────────────────────────────────────────────
    function goToStep(stepNumber) {
        // Reveal the panel for this step (keep earlier panels visible as history)
        const panels = [stepPair, stepCalibrate, stepDiagnose, stepSession];
        panels.forEach((panel, i) => {
            if (panel && i + 1 === stepNumber) panel.hidden = false;
        });
        // Update nav dots
        navDots.forEach((dot, i) => {
            if (!dot) return;
            dot.classList.toggle("is-active", i + 1 === stepNumber);
            dot.classList.toggle("is-done", i + 1 < stepNumber);
        });
        // Fill connector bars for completed steps
        wizBars.forEach((bar, i) => {
            if (bar) bar.classList.toggle("is-done", i + 1 < stepNumber);
        });
    }

    // ── STEP 1: Connect ───────────────────────────────────────────────────────
    pairButton?.addEventListener("click", async () => {
        pairButton.disabled = true;
        if (searchingAnim) searchingAnim.hidden = false;
        setMsg(pairStatus, "Searching for glove on Wi-Fi…");

        await new Promise(r => setTimeout(r, 1600));

        const found = Math.random() > 0.15;
        if (!found) {
            if (searchingAnim) searchingAnim.hidden = true;
            pairButton.disabled = false;
            setMsg(pairStatus, "Glove not found. Confirm both devices are on the same 2.4GHz network and try again.");
            return;
        }

        if (searchingAnim) searchingAnim.hidden = true;
        const gloveName = "Theraflow Glove";
        setMsg(pairStatus, `Connected to ${gloveName} over Wi-Fi.`);
        gloveConnected = true;
        announceGlovePaired(gloveName);
        goToStep(2);
    });

    function announceGlovePaired(name) {
        try {
            localStorage.setItem("theraflow_glove", JSON.stringify({
                connected: true,
                name,
                ip: "192.168.1.120",
                mac: "AA:BB:CC:DD:EE:FF",
                pairedAt: Date.now(),
                sessionActive: false,
                targetRepetitions: 120
            }));
        } catch { /* storage may be blocked in private-browsing mode */ }
    }

    // ── STEP 2: Calibrate ─────────────────────────────────────────────────────
    function renderCalibrationGrid() {
        if (!calibrationGrid) return;
        calibrationGrid.innerHTML = calibrationState.map(finger => {
            const zeroLocked = finger.zero !== null;
            const maxLocked = finger.max !== null;
            return `<div class="calibration-finger ${zeroLocked && maxLocked ? "is-locked" : ""}">
                <strong>${finger.name}</strong>
                <span>0&deg;: ${finger.zero === null ? "&mdash;" : `${finger.zero.toFixed(1)}&deg;`}</span>
                <span>Max: ${finger.max === null ? "&mdash;" : `${finger.max.toFixed(1)}&deg;`}</span>
            </div>`;
        }).join("");
    }

    function updateCalibrationPrompt() {
        if (calibrationPhase === "zero") {
            setMsg(calibrationStatus, "Keep hand still — reading baseline for all 5 fingers…");
            setMsg(calibrationPrompt, "Rest your hand flat and relaxed. The system will capture the 0° baseline.");
            if (calibrateBtn) calibrateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Capture Zero Point';
            return;
        }

        setMsg(calibrationStatus, "Make a firm fist — capturing maximum flex for all 5 fingers…");
        setMsg(calibrationPrompt, "Close your hand into a fist to capture the maximum flex baseline.");
        if (calibrateBtn) calibrateBtn.innerHTML = '<i class="fa-solid fa-hand-fist"></i> Capture Max Flex';
    }

    calibrateBtn?.addEventListener("click", async () => {
        calibrateBtn.disabled = true;
        updateCalibrationPrompt();

        if (calibrationPhase === "zero") {
            for (let i = 0; i < calibrationState.length; i++) {
                calibrationState[i].zero = await readGloveValue(0, 12);
                renderCalibrationGrid();
                await new Promise(r => setTimeout(r, 300));
            }
            calibrationPhase = "max";
            calibrateBtn.disabled = false;
            setMsg(calibrationStatus, "Zero point recorded. Now capture maximum flex.");
            updateCalibrationPrompt();
            return;
        }

        for (let i = 0; i < calibrationState.length; i++) {
            calibrationState[i].max = await readGloveValue(120, 180);
            renderCalibrationGrid();
            await new Promise(r => setTimeout(r, 300));
        }

        calibrationComplete = true;
        const count = calibrationState.filter(f => f.zero !== null && f.max !== null).length;
        const avgMax = calibrationState.reduce((sum, finger) => sum + (finger.max || 0), 0) / calibrationState.length;
        diagResults.maxFlexion = avgMax;
        diagResults.maxExtension = avgMax;
        setMsg(calibrationStatus, `${count}/5 fingers calibrated. Calibration complete.`);
        goToStep(3);
        loadTherapyPlan();
    });

    renderCalibrationGrid();

    // ── STEP 3: Mode Selection ───────────────────────────────────────────────
    const testState = {
        trial: 0,
        grip: [],
        flex: [],
        ext: []
    };

    function applyTherapyPlan(plan) {
        planDurationMin = Number(plan.duration_min || plan.durationMin || 15);
        planTargetReps = Number(plan.target_repetitions || plan.targetRepetitions || 120);
        planExerciseType = String(plan.exercise_type || plan.exerciseType || "Active Grip");

        if (therapyDurationEl) therapyDurationEl.textContent = `${planDurationMin} min`;
        if (therapyRepsEl) therapyRepsEl.textContent = `${planTargetReps} reps`;
        if (therapyTypeEl) therapyTypeEl.textContent = planExerciseType;
        if (targetRepsEl) targetRepsEl.textContent = String(planTargetReps);

        sessionState.targetRepetitions = planTargetReps;
    }

    function loadTherapyPlan() {
        setMsg(diagStatus, "Loading your therapy plan…");
        fetch("api/patient/doctor_assignments.php")
            .then(response => response.ok ? response.json() : Promise.reject())
            .then(payload => {
                if (!payload?.ok || !payload?.plan) {
                    throw new Error(payload?.error || "Unable to load plan.");
                }
                applyTherapyPlan(payload.plan);
                setMsg(diagStatus, "Plan ready. Choose a mode to continue.");
            })
            .catch(() => {
                applyTherapyPlan({ duration_min: 15, target_repetitions: 120, exercise_type: "Active Grip" });
                setMsg(diagStatus, "Plan unavailable. Using default targets.");
            });
    }

    function showSessionPane(mode) {
        if (therapySessionPane) therapySessionPane.classList.toggle("is-hidden", mode !== "therapy");
        if (testSessionPane) testSessionPane.classList.toggle("is-hidden", mode !== "test");
        if (sessionIntro) {
            sessionIntro.textContent = mode === "therapy"
                ? "Therapy mode selected. Press Start Session to begin your prescribed movements."
                : "Test mode selected. Complete 3 trials for each movement to record your assessment.";
        }
    }

    function resetTestState() {
        testState.trial = 0;
        testState.grip = [];
        testState.flex = [];
        testState.ext = [];
        if (testTrialCountEl) testTrialCountEl.textContent = "0/3";
        if (testGripAvgEl) testGripAvgEl.textContent = "—";
        if (testFlexAvgEl) testFlexAvgEl.textContent = "—";
        if (testExtAvgEl) testExtAvgEl.textContent = "—";
        if (testPromptEl) testPromptEl.textContent = "Complete 3 trials for each movement to log your assessment.";
        if (testActionBtn) testActionBtn.textContent = "Begin Trial 1";
    }

    async function saveRecoveryProgress(payload) {
        try {
            const res = await fetch("api/patient/recovery_progress.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) throw new Error(data?.error || "Save failed");
            setMsg(sessionStatus, "Assessment saved. Your doctor can review the averages.");
        } catch (err) {
            setMsg(sessionStatus, err instanceof Error ? err.message : "Failed to save assessment.");
        }
    }

    async function recordTestTrial() {
        if (testState.trial >= 3) return;
        if (testActionBtn) testActionBtn.disabled = true;

        const grip = await readGloveValue(20, 80);
        const flex = await readGloveValue(120, 180);
        const ext = await readGloveValue(140, 185);

        testState.trial += 1;
        testState.grip.push(grip);
        testState.flex.push(flex);
        testState.ext.push(ext);

        const avgGrip = testState.grip.reduce((sum, val) => sum + val, 0) / testState.grip.length;
        const avgFlex = testState.flex.reduce((sum, val) => sum + val, 0) / testState.flex.length;
        const avgExt = testState.ext.reduce((sum, val) => sum + val, 0) / testState.ext.length;

        if (testGripAvgEl) testGripAvgEl.textContent = `${avgGrip.toFixed(1)} N`;
        if (testFlexAvgEl) testFlexAvgEl.textContent = `${avgFlex.toFixed(1)}°`;
        if (testExtAvgEl) testExtAvgEl.textContent = `${avgExt.toFixed(1)}°`;
        if (testTrialCountEl) testTrialCountEl.textContent = `${testState.trial}/3`;

        if (testState.trial < 3) {
            if (testPromptEl) testPromptEl.textContent = `Trial ${testState.trial} captured. Prepare for trial ${testState.trial + 1}.`;
            if (testActionBtn) {
                testActionBtn.textContent = `Begin Trial ${testState.trial + 1}`;
                testActionBtn.disabled = false;
            }
            return;
        }

        diagResults.peakForce = avgGrip;
        diagResults.maxFlexion = avgFlex;
        diagResults.maxExtension = avgExt;

        if (testPromptEl) testPromptEl.textContent = "Assessment complete. Saving averages…";
        if (testActionBtn) {
            testActionBtn.textContent = "Assessment Complete";
            testActionBtn.disabled = true;
        }

        await saveRecoveryProgress({
            avgGripStrength: avgGrip,
            avgFlexion: avgFlex,
            avgExtension: avgExt
        });
    }

    therapyStartBtn?.addEventListener("click", () => {
        if (!calibrationComplete) {
            setMsg(diagStatus, "Complete calibration before choosing a mode.");
            return;
        }
        selectedMode = "therapy";
        showSessionPane("therapy");
        goToStep(4);
        setMsg(sessionStatus, "");
    });

    testStartBtn?.addEventListener("click", () => {
        if (!calibrationComplete) {
            setMsg(diagStatus, "Complete calibration before choosing a mode.");
            return;
        }
        selectedMode = "test";
        resetTestState();
        showSessionPane("test");
        goToStep(4);
        setMsg(sessionStatus, "");
    });

    testActionBtn?.addEventListener("click", () => {
        void recordTestTrial();
    });

    // ── STEP 4: Session ───────────────────────────────────────────────────────
    startSessionBtn?.addEventListener("click", () => {
        if (selectedMode && selectedMode !== "therapy") {
            return;
        }
        if (sessionState.isRunning) return;
        sessionState.isRunning = true;
        sessionState.startTime = Date.now();
        sessionState.reps = 0;
        sessionState.totalForce = 0;
        sessionState.sampleCount = 0;
        startSessionBtn.disabled = true;
        if (endSessionBtn) endSessionBtn.disabled = false;
    setMsg(sessionStatus, "Session running — glove is streaming live data…");

        sessionState.intervalId = setInterval(async () => {
            const force   = await readGloveValue(15, 60);
            const newReps = Math.floor(pseudoRandom(1, 5));
            sessionState.reps        += newReps;
            sessionState.totalForce  += force;
            sessionState.sampleCount += 1;

            const avgForce = sessionState.totalForce / sessionState.sampleCount;
            const elapsed  = Math.floor((Date.now() - sessionState.startTime) / 1000);
            const mm = Math.floor(elapsed / 60);
            const ss = String(elapsed % 60).padStart(2, "0");

            if (sessionRepsEl)  sessionRepsEl.textContent  = String(sessionState.reps);
            if (sessionForceEl) sessionForceEl.textContent = `${avgForce.toFixed(1)} N`;
            if (sessionTimeEl)  sessionTimeEl.textContent  = `${mm}:${ss}`;

            // Broadcast live metrics to Home dashboard via localStorage
            try {
                const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
                gloveData.sessionReps   = sessionState.reps;
                gloveData.sessionForce  = avgForce.toFixed(1);
                gloveData.sessionActive = true;
                gloveData.targetRepetitions = sessionState.targetRepetitions;
                localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
            } catch { /* storage may be blocked */ }
        }, 2000);
    });

    endSessionBtn?.addEventListener("click", async () => {
        if (selectedMode && selectedMode !== "therapy") {
            return;
        }
        if (!sessionState.isRunning) return;
        clearInterval(sessionState.intervalId);
        sessionState.isRunning = false;
        if (endSessionBtn) endSessionBtn.disabled = true;
        setMsg(sessionStatus, "Saving session…");

        const avgForce = sessionState.sampleCount > 0
            ? sessionState.totalForce / sessionState.sampleCount
            : diagResults.peakForce;
        const sessionResult = sessionState.reps >= sessionState.targetRepetitions ? "Success" : "Needs Work";

        try {
            const res = await fetch("api/patient/exercise_session.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    peakForce: avgForce,
                    maxFlexion: diagResults.maxFlexion,
                    maxExtension: diagResults.maxExtension,
                    repetitions: sessionState.reps,
                    status: sessionResult
                })
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.ok) throw new Error(payload?.error || "Save failed");
            setMsg(sessionStatus, `Session saved (${sessionResult}) — great work!`);
            try {
                const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
                gloveData.sessionActive = false;
                gloveData.targetRepetitions = sessionState.targetRepetitions;
                localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
            } catch { /* storage may be blocked */ }
            startSessionBtn.disabled = false;
        } catch (err) {
            setMsg(sessionStatus, err instanceof Error ? err.message : "Failed to save session.");
            if (endSessionBtn) endSessionBtn.disabled = false;
        }
    });

    // Prefetch plan target from server
    loadTherapyPlan();

    goToStep(1);
}

function initializeRecoveryPage() {
    const root = document.getElementById("recoveryRoot");
    if (!root) {
        return;
    }

    const logsBody = document.getElementById("recoveryLogsBody");
    const forceCanvas = document.getElementById("recoveryForceChart");
    const romCanvas = document.getElementById("recoveryRomChart");
    const bestForceEl = document.getElementById("recoveryBestForce");
    const maxFlexionEl = document.getElementById("recoveryMaxFlexion");
    const totalSessionsEl = document.getElementById("recoveryTotalSessions");
    let forceChart = null;
    let romChart = null;

    function formatLogDate(rawDate) {
        const parsed = new Date(String(rawDate || ""));
        if (Number.isNaN(parsed.getTime())) {
            return "-";
        }

        return parsed.toLocaleString([], {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    }

    function normalizeRecoveryStatus(status) {
        const rawStatus = String(status || "");
        if (/success|stable|improv/i.test(rawStatus)) {
            return { label: "Stable", className: "is-stable" };
        }
        return { label: "Needs Work", className: "is-needs-work" };
    }

    function renderTrendChart(canvas, chartRef, label, labels, data, color, options = {}) {
        if (!canvas || typeof Chart === "undefined") {
            return chartRef;
        }

        if (chartRef) {
            chartRef.destroy();
        }

        const lastValueLabelPlugin = {
            id: "lastValueLabelPlugin",
            afterDatasetsDraw(chart, _args, pluginOptions) {
                const ctx = chart.ctx;
                const unit = String(pluginOptions?.unit || "");

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    if (datasetIndex > 0 && options.goalLineValue !== undefined) {
                        return;
                    }

                    const points = chart.getDatasetMeta(datasetIndex)?.data || [];
                    if (!points.length) {
                        return;
                    }

                    const lastPoint = points[points.length - 1];
                    const rawValue = dataset.data[dataset.data.length - 1];
                    const numericValue = Number(rawValue || 0);
                    const displayValue = Number.isFinite(numericValue)
                        ? `${numericValue.toFixed(1)}${unit}`
                        : `${rawValue}${unit}`;

                    ctx.save();
                    ctx.fillStyle = color;
                    ctx.font = "600 12px Segoe UI";
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";
                    ctx.fillText(displayValue, lastPoint.x + 8, lastPoint.y - 10);
                    ctx.restore();
                });
            }
        };

        const datasets = [{
            label,
            data,
            borderColor: color,
            backgroundColor: "transparent",
            borderWidth: 2.4,
            tension: 0.45,
            pointRadius: context => (context.dataIndex === data.length - 1 ? 4 : 3),
            pointHoverRadius: 5
        }];

        if (typeof options.goalLineValue === "number") {
            datasets.push({
                label: `Goal Line (${options.goalLineValue}\u00b0)`,
                data: labels.map(() => options.goalLineValue),
                borderColor: "#f0b94b",
                backgroundColor: "transparent",
                borderWidth: 1.8,
                borderDash: [7, 6],
                pointRadius: 0,
                tension: 0
            });
        }

        return new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        right: 44
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            boxWidth: 18,
                            boxHeight: 2,
                            usePointStyle: false
                        }
                    }
                }
            },
            plugins: [{
                ...lastValueLabelPlugin,
                afterDatasetsDraw(chart, args) {
                    lastValueLabelPlugin.afterDatasetsDraw(chart, args, { unit: options.unit || "" });
                }
            }]
        });
    }

    fetch("api/patient/recovery.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load recovery analytics.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load recovery analytics.");
            }

            const labels = Array.isArray(payload?.trend?.labels) ? payload.trend.labels : ["No Data"];
            const force = Array.isArray(payload?.trend?.force) ? payload.trend.force : [0];
            const rom = Array.isArray(payload?.trend?.rom) ? payload.trend.rom : [0];

            const romGoal = Number(payload?.targets?.romGoal || 180);

            forceChart = renderTrendChart(forceCanvas, forceChart, "Force (N)", labels, force, "#0d5f73", { unit: " N" });
            romChart = renderTrendChart(romCanvas, romChart, "Flexion (\u00b0)", labels, rom, "#2f9b72", {
                unit: "\u00b0",
                goalLineValue: romGoal
            });

            const quickStats = payload?.quickStats || {};
            if (bestForceEl) {
                bestForceEl.textContent = `${Number(quickStats.bestForce || 0).toFixed(1)} N`;
            }
            if (maxFlexionEl) {
                maxFlexionEl.textContent = `${Number(quickStats.maxFlexion || 0).toFixed(1)}\u00b0`;
            }
            if (totalSessionsEl) {
                totalSessionsEl.textContent = String(Number(quickStats.totalSessions || 0));
            }

            if (logsBody) {
                const logs = Array.isArray(payload.logs) ? payload.logs : [];
                logsBody.innerHTML = logs.length
                    ? logs.map(log => `
                        <tr>
                            <td>${formatLogDate(log.timestamp)}</td>
                            <td>${Number(log.grip_strength || 0).toFixed(1)}</td>
                            <td>${Number(log.flexion_angle || 0).toFixed(1)}</td>
                            <td>${Number(log.repetitions || 0)}</td>
                            <td><span class="recovery-status-badge ${normalizeRecoveryStatus(log.status).className}">${normalizeRecoveryStatus(log.status).label}</span></td>
                        </tr>
                    `).join("")
                    : '<tr><td colspan="5">No session logs yet.</td></tr>';
            }
        })
        .catch(() => {
            if (logsBody) {
                logsBody.innerHTML = '<tr><td colspan="5">Unable to load session logs.</td></tr>';
            }
        });
}

function initializePatientMessagesPage() {
    const root = document.getElementById("patientMessagesRoot");
    if (!root) {
        return;
    }

    const thread = document.getElementById("patientThread");
    const composeInput = document.getElementById("patientComposeInput");
    const sendButton = document.getElementById("patientSendBtn");
    const attachButton = document.getElementById("patientAttachBtn");
    const activeMeta = document.getElementById("patientActiveMeta");
    const doctorNote = document.getElementById("patientDoctorNote");
    const doctorNameEl = document.getElementById("patientActiveDoctorName");
    const pageSubtitleEl = document.getElementById("patientMessagesSubtitle");
    const doctorInfoButton = document.getElementById("patientDoctorInfoBtn");
    const doctorInfoModal = document.getElementById("patientDoctorInfoModal");
    const doctorInfoBackdrop = document.getElementById("patientDoctorInfoBackdrop");
    const doctorInfoClose = document.getElementById("patientDoctorInfoClose");
    const doctorInfoAvatar = document.getElementById("doctorInfoAvatar");
    const doctorInfoName = document.getElementById("doctorInfoName");
    const doctorInfoTitle = document.getElementById("doctorInfoTitle");
    const doctorInfoSpecialty = document.getElementById("doctorInfoSpecialty");
    const doctorInfoHospital = document.getElementById("doctorInfoHospital");
    const doctorInfoEmail = document.getElementById("doctorInfoEmail");
    const doctorInfoContact = document.getElementById("doctorInfoContact");
    const doctorInfoBio = document.getElementById("doctorInfoBio");
    let conversation = { messages: [] };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatMessageTime(rawDate) {
        const parsed = new Date(String(rawDate || ""));
        if (Number.isNaN(parsed.getTime())) {
            return "Just now";
        }

        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - parsed.getTime()) / 1000);

        if (diffSeconds < 10) {
            return "Just now";
        }

        if (diffSeconds < 60) {
            return `${diffSeconds}s ago`;
        }

        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        }

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return `${diffHours}h ago`;
        }

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) {
            return `Yesterday ${parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
        }

        if (diffDays < 7) {
            return `${diffDays}d ago`;
        }

        return parsed.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function resolveConversationLabel(name) {
        const cleanedName = String(name || "").trim();
        if (!cleanedName) {
            return "Dr. Care Team";
        }
        return cleanedName;
    }

    function applyDoctorLabels(rawName) {
        const doctorName = resolveConversationLabel(rawName);
        if (doctorNameEl) {
            doctorNameEl.textContent = `Messages with ${doctorName}`;
        }
        if (pageSubtitleEl) {
            pageSubtitleEl.textContent = `Secure chat with ${doctorName}.`;
        }
    }

    function setDoctorInfoLoading() {
        if (doctorInfoAvatar) {
            doctorInfoAvatar.style.backgroundImage = "";
            doctorInfoAvatar.innerHTML = '<i class="fa-solid fa-user-doctor"></i>';
        }
        if (doctorInfoName) doctorInfoName.textContent = "Loading...";
        if (doctorInfoTitle) doctorInfoTitle.textContent = "--";
        if (doctorInfoSpecialty) doctorInfoSpecialty.textContent = "--";
        if (doctorInfoHospital) doctorInfoHospital.textContent = "--";
        if (doctorInfoEmail) doctorInfoEmail.textContent = "--";
        if (doctorInfoContact) doctorInfoContact.textContent = "--";
        if (doctorInfoBio) doctorInfoBio.textContent = "--";
    }

    function setDoctorInfo(profile) {
        if (!profile) {
            if (doctorInfoAvatar) {
                doctorInfoAvatar.style.backgroundImage = "";
                doctorInfoAvatar.innerHTML = '<i class="fa-solid fa-user-doctor"></i>';
            }
            if (doctorInfoName) doctorInfoName.textContent = "No assigned doctor yet.";
            if (doctorInfoTitle) doctorInfoTitle.textContent = "--";
            if (doctorInfoSpecialty) doctorInfoSpecialty.textContent = "--";
            if (doctorInfoHospital) doctorInfoHospital.textContent = "--";
            if (doctorInfoEmail) doctorInfoEmail.textContent = "--";
            if (doctorInfoContact) doctorInfoContact.textContent = "--";
            if (doctorInfoBio) doctorInfoBio.textContent = "--";
            return;
        }

        if (doctorInfoAvatar) {
            const avatarUrl = String(profile.avatarDataUrl || "").trim();
            if (avatarUrl) {
                doctorInfoAvatar.style.backgroundImage = `url(${avatarUrl})`;
                doctorInfoAvatar.innerHTML = "";
            } else {
                doctorInfoAvatar.style.backgroundImage = "";
                doctorInfoAvatar.innerHTML = '<i class="fa-solid fa-user-doctor"></i>';
            }
        }

        if (doctorInfoName) doctorInfoName.textContent = profile.displayName || "Doctor";
        if (doctorInfoTitle) doctorInfoTitle.textContent = profile.title || "Doctor";
        if (doctorInfoSpecialty) doctorInfoSpecialty.textContent = profile.specialty || "Not specified";
        if (doctorInfoHospital) doctorInfoHospital.textContent = profile.hospital || "Not specified";
        if (doctorInfoEmail) doctorInfoEmail.textContent = profile.email || "Not available";
        if (doctorInfoContact) doctorInfoContact.textContent = profile.contact || "Not available";
        if (doctorInfoBio) doctorInfoBio.textContent = profile.bio || "No bio provided.";
    }

    function openDoctorInfoModal() {
        if (!doctorInfoModal) return;
        doctorInfoModal.hidden = false;
        setDoctorInfoLoading();

        fetch("api/patient/doctor_profile.php")
            .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load doctor info.")))
            .then(payload => {
                if (!payload?.ok) {
                    throw new Error(payload?.error || "Unable to load doctor info.");
                }
                setDoctorInfo(payload.profile || null);
            })
            .catch(() => {
                setDoctorInfo(null);
            });
    }

    function closeDoctorInfoModal() {
        if (doctorInfoModal) {
            doctorInfoModal.hidden = true;
        }
    }

    function renderThread() {
        if (!thread) {
            return;
        }

        const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
        thread.innerHTML = messages.length
            ? messages.map(message => {
                const bubbleClass = message.from === "patient" ? "patient-self" : "doctor-self";
                const safeText = escapeHtml(message.text || "");
                const messageTime = formatMessageTime(message.created_at);
                return `
                    <div class="message-row ${bubbleClass}">
                        <div class="message-bubble ${bubbleClass}">${safeText}</div>
                        <div class="message-time">${escapeHtml(messageTime)}</div>
                    </div>
                `;
            }).join("")
            : '<div class="message-row doctor-self"><div class="message-bubble doctor-self">No messages yet. Send your first update.</div></div>';
        thread.scrollTop = thread.scrollHeight;
    }

    function sendMessage() {
        const text = String(composeInput?.value || "").trim();
        if (!text) {
            return;
        }

        fetch("api/patient/messages.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: text })
        })
            .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to send message.")))
            .then(payload => {
                if (!payload?.ok) {
                    throw new Error(payload?.error || "Unable to send message.");
                }

                conversation.messages.push({ from: "patient", text, created_at: new Date().toISOString() });
                if (composeInput) {
                    composeInput.value = "";
                }
                renderThread();
                activeMeta && (activeMeta.textContent = "Message sent.");
            })
            .catch(() => {
                activeMeta && (activeMeta.textContent = "Failed to send. Try again.");
            });
    }

    sendButton?.addEventListener("click", sendMessage);
    attachButton?.addEventListener("click", () => {
        if (activeMeta) {
            activeMeta.textContent = "Attachments will be available soon.";
        }
    });

    doctorInfoButton?.addEventListener("click", openDoctorInfoModal);
    doctorInfoClose?.addEventListener("click", closeDoctorInfoModal);
    doctorInfoBackdrop?.addEventListener("click", closeDoctorInfoModal);
    window.addEventListener("keydown", event => {
        if (event.key === "Escape" && doctorInfoModal && !doctorInfoModal.hidden) {
            closeDoctorInfoModal();
        }
    });
    composeInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });

    fetch("api/patient/messages.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load conversation.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load conversation.");
            }

            conversation = payload.conversation || { messages: [] };
            applyDoctorLabels(conversation?.name);
            renderThread();

            const note = payload.latestDoctorNote;
            if (doctorNote && note?.text) {
                const noteTime = formatMessageTime(note.created_at);
                doctorNote.textContent = `${note.text} • ${noteTime}`;
            }
        })
        .catch(() => {
            applyDoctorLabels("");
            renderThread();
            if (activeMeta) {
                activeMeta.textContent = "Offline mode. New messages will sync once connected.";
            }
        });
}

function initializePatientSettingsPage() {
    const root = document.getElementById("patientSettingsRoot");
    if (!root) {
        return;
    }

    const form = document.getElementById("patientSettingsForm");
    const nameInput = document.getElementById("patientSettingsName");
    const emailInput = document.getElementById("patientSettingsEmail");
    const togglePasswordButton = document.getElementById("patientPasswordModalBtn");
    const passwordFields = document.getElementById("patientPasswordFields");
    const passwordModal = document.getElementById("patientPasswordModal");
    const passwordBackdrop = document.getElementById("patientPasswordBackdrop");
    const passwordCloseButton = document.getElementById("patientPasswordClose");
    const passwordCancelButton = document.getElementById("patientPasswordCancel");
    const nameEditButton = document.getElementById("patientNameEditBtn");
    const contactEditButton = document.getElementById("patientContactEditBtn");
    const currentPasswordInput = document.getElementById("patientCurrentPassword");
    const newPasswordInput = document.getElementById("patientNewPassword");
    const confirmPasswordInput = document.getElementById("patientConfirmPassword");
    const passwordSaveButton = document.getElementById("patientPasswordSaveBtn");
    const feedback = document.getElementById("patientSettingsFeedback");
    const syncStatus = document.getElementById("patientSettingsSyncStatus");
    const batteryEl = document.getElementById("diagBattery");
    const signalEl = document.getElementById("diagSignal");
    const connectionEl = document.getElementById("diagConnection");
    const ssidEl = document.getElementById("diagSsid");
    const batteryTile = document.getElementById("diagBatteryTile");
    const signalTile = document.getElementById("diagSignalTile");
    const ssidTile = document.getElementById("diagSsidTile");
    const connectionTile = document.getElementById("diagConnectionTile");
    const refreshDiagnosticsButton = document.getElementById("diagRefreshBtn");
    const diagnosisInput = document.getElementById("patientDiagnosis");
    const assignedDoctorInput = document.getElementById("patientAssignedDoctor");
    const treatmentGoalInput = document.getElementById("patientTreatmentGoal");
    const ageInput = document.getElementById("patientAge");
    const profileCard = form?.closest(".user-profile-card") || document.querySelector(".user-profile-card");

    let initialName = "";
    let initialContact = "";
    let isPasswordEditing = false;

    function setFeedback(message) {
        if (feedback) {
            feedback.textContent = message;
        }
    }

    function setSyncStatus(message) {
        if (syncStatus) {
            syncStatus.textContent = message;
        }
    }

    function setMedicalInfo(data) {
        if (diagnosisInput) diagnosisInput.value = data?.diagnosis || "Pending clinical intake";
        if (assignedDoctorInput) assignedDoctorInput.value = data?.assigned_doctor || "Not assigned";
        if (treatmentGoalInput) treatmentGoalInput.value = data?.treatment_goal || "Pending provider update";
    }

    function setPatientAge(ageValue) {
        if (!ageInput) return;
        const parsedAge = Number(ageValue);
        if (Number.isFinite(parsedAge) && parsedAge > 0) {
            ageInput.value = String(parsedAge);
        } else {
            ageInput.value = "Not provided";
        }
    }

    function markOffline(isOffline) {
        [batteryTile, signalTile, ssidTile, connectionTile].forEach(tile => {
            if (!tile) return;
            tile.classList.toggle("is-offline", isOffline);
        });
    }

    function runDiagnostics() {
        let gloveState = {};
        try {
            gloveState = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
        } catch {
            gloveState = {};
        }

        const isOnline = Boolean(gloveState.connected || gloveState.sessionActive || gloveState.heartbeat === true);
        if (!isOnline) {
            markOffline(true);
            if (batteryEl) batteryEl.textContent = "N/A";
            if (signalEl) signalEl.textContent = "N/A";
            if (ssidEl) ssidEl.textContent = "Offline";
            if (connectionEl) connectionEl.textContent = "Offline";
            return;
        }

        markOffline(false);
        const battery = Number(gloveState.battery || gloveState.batteryPercent || 0);
        const rssi = Number(gloveState.rssi || gloveState.signal || -55);
        const ssid = String(gloveState.ssid || gloveState.network || "Unknown");

        if (batteryEl) batteryEl.textContent = battery ? `${battery}%` : `${Math.floor(Math.random() * 30) + 70}%`;
        if (signalEl) signalEl.textContent = `${rssi || -55} dBm`;
        if (ssidEl) ssidEl.textContent = ssid;
        if (connectionEl) connectionEl.textContent = "Online (Cloud)";
    }

    function setPasswordEditing(enabled) {
        isPasswordEditing = enabled;
        if (profileCard) {
            profileCard.classList.toggle("is-password-open", enabled);
        }
        if (passwordModal) {
            passwordModal.hidden = !enabled;
        }
        if (passwordFields) {
            passwordFields.classList.toggle("is-hidden", !enabled);
        }
        if (togglePasswordButton) {
            togglePasswordButton.setAttribute("aria-expanded", String(enabled));
        }
        if (passwordSaveButton) {
            passwordSaveButton.disabled = true;
        }
        if (!enabled) {
            if (currentPasswordInput) currentPasswordInput.value = "";
            if (newPasswordInput) newPasswordInput.value = "";
            if (confirmPasswordInput) confirmPasswordInput.value = "";
        }
    }

    function isValidContact(value) {
        const trimmed = value.trim();
        if (!trimmed) return false;
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
        const isPhone = /^[+]?\d{7,15}$/.test(trimmed.replace(/\s+/g, ""));
        return isEmail || isPhone;
    }

    function setFieldEditing(fieldGroup, input, button, enabled) {
        if (fieldGroup) {
            fieldGroup.classList.toggle("is-editing", enabled);
        }
        if (input) {
            input.readOnly = !enabled;
            if (enabled) {
                input.focus();
            }
        }
        if (button) {
            const icon = button.querySelector("i");
            if (icon) {
                icon.className = enabled ? "fa-solid fa-check" : "fa-solid fa-pen";
            }
        }
    }

    function setFieldSaving(fieldGroup, input, button) {
        if (fieldGroup) {
            fieldGroup.classList.remove("is-editing");
        }
        if (input) {
            input.readOnly = true;
        }
        if (button) {
            const icon = button.querySelector("i");
            if (icon) {
                icon.className = "fa-solid fa-check";
            }
        }
    }

    async function syncProfileUpdate({ name, contact, currentPassword, newPassword }, button) {
        if (button) {
            button.classList.add("is-saving");
        }
        setFeedback("Syncing updates...");
        setSyncStatus("");

        try {
            const response = await fetch("api/patient/settings.php", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email: contact, currentPassword, newPassword })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || "Unable to sync updates.");
            }

            initialName = String(payload.profile?.name || name || "").trim();
            initialContact = String(payload.profile?.email || contact || "").trim();
            if (nameInput) nameInput.value = initialName;
            if (emailInput) emailInput.value = initialContact;

            setFeedback("");
            setSyncStatus(payload.syncStatus || "Saved changes.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to sync updates.";
            setFeedback(message);
            setSyncStatus("Sync pending. Please try again.");
        } finally {
            if (button) {
                button.classList.remove("is-saving");
                const icon = button.querySelector("i");
                if (icon) {
                    icon.className = "fa-solid fa-pen";
                }
            }
        }
    }

    refreshDiagnosticsButton?.addEventListener("click", runDiagnostics);
    togglePasswordButton?.addEventListener("click", () => setPasswordEditing(true));
    passwordCloseButton?.addEventListener("click", () => setPasswordEditing(false));
    passwordCancelButton?.addEventListener("click", () => setPasswordEditing(false));
    passwordBackdrop?.addEventListener("click", () => setPasswordEditing(false));
    window.addEventListener("keydown", event => {
        if (event.key === "Escape" && passwordModal && !passwordModal.hidden) {
            setPasswordEditing(false);
        }
    });

    nameEditButton?.addEventListener("click", () => {
        const group = nameEditButton.closest(".has-inline-edit");
        const editing = group?.classList.contains("is-editing");
        if (!editing) {
            setFieldEditing(group, nameInput, nameEditButton, true);
            return;
        }

        const nextName = String(nameInput?.value || "").trim();
        if (!nextName) {
            setFeedback("Name is required.");
            return;
        }

        setFieldSaving(group, nameInput, nameEditButton);
        void syncProfileUpdate({ name: nextName, contact: String(emailInput?.value || "").trim() }, nameEditButton);
    });

    contactEditButton?.addEventListener("click", () => {
        const group = contactEditButton.closest(".has-inline-edit");
        const editing = group?.classList.contains("is-editing");
        if (!editing) {
            setFieldEditing(group, emailInput, contactEditButton, true);
            return;
        }

        const nextContact = String(emailInput?.value || "").trim();
        if (!isValidContact(nextContact)) {
            setFeedback("Contact must be a valid email or phone number.");
            return;
        }

        setFieldSaving(group, emailInput, contactEditButton);
        void syncProfileUpdate({ name: String(nameInput?.value || "").trim(), contact: nextContact }, contactEditButton);
    });

    function updatePasswordSaveState() {
        if (!passwordSaveButton || !isPasswordEditing) return;
        const currentPassword = String(currentPasswordInput?.value || "");
        const newPassword = String(newPasswordInput?.value || "");
        const confirmPassword = String(confirmPasswordInput?.value || "");
        passwordSaveButton.disabled = !(currentPassword && newPassword && confirmPassword && newPassword === confirmPassword);
    }

    currentPasswordInput?.addEventListener("input", updatePasswordSaveState);
    newPasswordInput?.addEventListener("input", updatePasswordSaveState);
    confirmPasswordInput?.addEventListener("input", updatePasswordSaveState);

    form?.addEventListener("submit", event => {
        event.preventDefault();
        if (!isPasswordEditing) {
            return;
        }

        const currentPassword = String(currentPasswordInput?.value || "");
        const newPassword = String(newPasswordInput?.value || "");
        const confirmPassword = String(confirmPasswordInput?.value || "");

        if (!currentPassword || !newPassword || !confirmPassword) {
            setFeedback("To change your password, fill current, new, and confirm password.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setFeedback("New password and confirm password must match.");
            return;
        }

        if (passwordSaveButton) {
            passwordSaveButton.classList.add("is-loading");
            passwordSaveButton.disabled = true;
        }

        void syncProfileUpdate(
            {
                name: String(nameInput?.value || "").trim(),
                contact: String(emailInput?.value || "").trim(),
                currentPassword,
                newPassword
            },
            passwordSaveButton
        ).finally(() => {
            if (passwordSaveButton) {
                passwordSaveButton.classList.remove("is-loading");
            }
            setPasswordEditing(false);
        });
    });

    fetch("api/patient/settings.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load settings.")))
        .then(payload => {
            if (!payload?.ok || !payload?.profile) {
                throw new Error(payload?.error || "Unable to load settings.");
            }

            if (nameInput) {
                nameInput.value = payload.profile.name || "";
            }
            if (emailInput) {
                emailInput.value = payload.profile.email || "";
            }
            initialName = String(payload.profile.name || "").trim();
            initialContact = String(payload.profile.email || "").trim();
            setFieldEditing(nameInput?.closest(".has-inline-edit"), nameInput, nameEditButton, false);
            setFieldEditing(emailInput?.closest(".has-inline-edit"), emailInput, contactEditButton, false);
            setFeedback("");
            setSyncStatus(payload.syncStatus || "");
        })
        .catch(() => {
            setFeedback("Unable to load profile settings.");
        });

    fetch("api/patient/profile_details.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load medical profile.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load medical profile.");
            }
            setMedicalInfo(payload.clinical || {});
            setPatientAge(payload?.patient?.age ?? null);
        })
        .catch(() => {
            setMedicalInfo({});
            setPatientAge(null);
        });

    runDiagnostics();
}

function initializeSettingsPage() {
    const settingsRoot = document.getElementById("settingsPageRoot");
    if (!settingsRoot) {
        return;
    }

    const settingsForm = document.getElementById("settingsForm");
    const cancelButton = document.getElementById("settingsCancelBtn");
    const avatarInput = document.getElementById("settingsAvatarInput");
    const avatarPreview = document.getElementById("settingsAvatarPreview");
    const displayNameInput = document.getElementById("settingsDisplayName");
    const titleInput = document.getElementById("settingsTitleInput");
    const specialtyInput = document.getElementById("settingsSpecialty");
    const hospitalInput = document.getElementById("settingsHospital");
    const bioInput = document.getElementById("settingsBio");
    const emailInput = document.getElementById("settingsEmail");
    const togglePasswordButton = document.getElementById("settingsTogglePasswordBtn");
    const passwordFields = document.getElementById("settingsPasswordFields");
    const currentPasswordInput = document.getElementById("settingsCurrentPassword");
    const newPasswordInput = document.getElementById("settingsNewPassword");
    const confirmPasswordInput = document.getElementById("settingsConfirmPassword");
    const successToast = document.getElementById("settingsSuccessToast");
    const settingsError = document.getElementById("settingsFormError");

    const defaultProfile = {
        displayName: "",
        title: "",
        specialty: "Neurology",
        hospital: "",
        bio: "",
        email: "",
        avatarDataUrl: ""
    };

    let draftProfile = { ...defaultProfile };
    let isPasswordEditing = false;

    function getStoredProfile() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.doctorProfile);
            if (!raw) {
                return { ...defaultProfile };
            }

            return { ...defaultProfile, ...JSON.parse(raw) };
        } catch {
            return { ...defaultProfile };
        }
    }

    function setSettingsMessage(message) {
        if (settingsError) {
            settingsError.textContent = message;
        }
    }

    function clearPasswordFields() {
        if (currentPasswordInput) {
            currentPasswordInput.value = "";
        }
        if (newPasswordInput) {
            newPasswordInput.value = "";
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.value = "";
            confirmPasswordInput.setCustomValidity("");
        }
    }

    function setPasswordEditing(enabled) {
        isPasswordEditing = enabled;

        if (passwordFields) {
            passwordFields.classList.toggle("is-hidden", !enabled);
        }

        if (togglePasswordButton) {
            togglePasswordButton.textContent = enabled ? "Cancel Password Change" : "Change Password";
            togglePasswordButton.setAttribute("aria-expanded", String(enabled));
        }

        if (!enabled) {
            clearPasswordFields();
        }
    }

    function ensureSpecialtyOption(value) {
        if (!specialtyInput || !value) {
            return;
        }

        const exists = Array.from(specialtyInput.options).some(option => option.value === value);
        if (!exists) {
            const dynamicOption = document.createElement("option");
            dynamicOption.value = value;
            dynamicOption.textContent = value;
            specialtyInput.appendChild(dynamicOption);
        }
    }

    function updateAvatarPreview(avatarDataUrl) {
        if (!avatarPreview) {
            return;
        }

        if (avatarDataUrl) {
            avatarPreview.style.backgroundImage = `url(${avatarDataUrl})`;
            avatarPreview.style.borderStyle = "solid";
            avatarPreview.innerHTML = "";
        } else {
            avatarPreview.style.backgroundImage = "";
            avatarPreview.style.borderStyle = "dashed";
            avatarPreview.innerHTML = "<i class=\"fa-regular fa-user\"></i>";
        }
    }

    function fillForm(profile) {
        if (displayNameInput) {
            displayNameInput.value = profile.displayName;
        }
        if (titleInput) {
            titleInput.value = profile.title;
        }
        if (specialtyInput) {
            ensureSpecialtyOption(profile.specialty);
            specialtyInput.value = profile.specialty;
        }
        if (hospitalInput) {
            hospitalInput.value = profile.hospital;
        }
        if (bioInput) {
            bioInput.value = profile.bio;
        }
        if (emailInput) {
            emailInput.value = profile.email;
        }
        if (currentPasswordInput) {
            currentPasswordInput.value = "";
        }
        if (newPasswordInput) {
            newPasswordInput.value = "";
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.value = "";
        }

        updateAvatarPreview(profile.avatarDataUrl || "");
    }

    async function loadProfileFromServer() {
        setSettingsMessage("Loading your registered profile...");

        try {
            const response = await fetch("api/doctor/settings.php", {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok || !payload.profile) {
                throw new Error(payload.error || "Could not load profile from server.");
            }

            draftProfile = {
                ...defaultProfile,
                ...getStoredProfile(),
                ...payload.profile
            };

            fillForm(draftProfile);
            localStorage.setItem(STORAGE_KEYS.doctorProfile, JSON.stringify(draftProfile));
            setSettingsMessage("");
        } catch (error) {
            draftProfile = getStoredProfile();
            fillForm(draftProfile);

            const message = error instanceof Error ? error.message : "Unable to load your profile.";
            if (/Unauthorized/i.test(message)) {
                setSettingsMessage("Your session expired. Please log in again.");
            } else {
                setSettingsMessage("Using saved local profile. " + message);
            }
        }
    }

    function showSuccessToast() {
        if (!successToast) {
            return;
        }

        successToast.hidden = false;
        setTimeout(() => {
            successToast.hidden = true;
        }, 2400);
    }

    avatarInput?.addEventListener("change", () => {
        const selectedFile = avatarInput.files?.[0];
        if (!selectedFile) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            draftProfile.avatarDataUrl = String(reader.result || "");
            updateAvatarPreview(draftProfile.avatarDataUrl);
        };
        reader.readAsDataURL(selectedFile);
    });

    cancelButton?.addEventListener("click", () => {
        draftProfile = getStoredProfile();
        fillForm(draftProfile);
        setPasswordEditing(false);
        setSettingsMessage("");
    });

    togglePasswordButton?.addEventListener("click", () => {
        setSettingsMessage("");
        setPasswordEditing(!isPasswordEditing);
        if (isPasswordEditing) {
            currentPasswordInput?.focus();
        }
    });

    settingsForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!(event.currentTarget instanceof HTMLFormElement)) {
            return;
        }

        if (!event.currentTarget.checkValidity()) {
            event.currentTarget.reportValidity();
            return;
        }

        setSettingsMessage("");

        const nextCurrent = currentPasswordInput?.value || "";
        const nextNew = newPasswordInput?.value || "";
        const nextConfirm = confirmPasswordInput?.value || "";
        const hasPasswordInput = isPasswordEditing && Boolean(nextCurrent || nextNew || nextConfirm);

        if (isPasswordEditing && !hasPasswordInput) {
            setSettingsMessage("Enter your current and new password, or cancel password change.");
            return;
        }

        if (hasPasswordInput && (!nextCurrent || !nextNew || !nextConfirm)) {
            setSettingsMessage("To change your password, fill current, new, and confirm password.");
            return;
        }

        if (hasPasswordInput && nextNew !== nextConfirm) {
            if (confirmPasswordInput) {
                confirmPasswordInput.setCustomValidity("New password and confirm password must match.");
                confirmPasswordInput.reportValidity();
            }
            return;
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.setCustomValidity("");
        }

        const nextProfile = {
            ...draftProfile,
            displayName: displayNameInput?.value.trim() || "",
            title: titleInput?.value.trim() || "",
            specialty: specialtyInput?.value || "",
            hospital: hospitalInput?.value.trim() || "",
            bio: bioInput?.value.trim() || "",
            email: emailInput?.value.trim() || ""
        };

        setSettingsMessage("Saving changes...");

        try {
            const response = await fetch("api/doctor/settings.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...nextProfile,
                    currentPassword: nextCurrent,
                    newPassword: hasPasswordInput ? nextNew : ""
                })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Unable to save settings.");
            }

            draftProfile = {
                ...nextProfile,
                ...payload.profile
            };

            localStorage.setItem(STORAGE_KEYS.doctorProfile, JSON.stringify(draftProfile));
            fillForm(draftProfile);
            setPasswordEditing(false);
            setSettingsMessage("");
            showSuccessToast();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to save settings.";
            setSettingsMessage(message);
        }
    });

    draftProfile = getStoredProfile();
    fillForm(draftProfile);
    setPasswordEditing(false);
    void loadProfileFromServer();
}

function initializeLogoutFlow() {
    if (!logoutBtn) {
        return;
    }

    function clearAllCookies() {
        document.cookie.split(";").forEach(cookieEntry => {
            const cookieName = cookieEntry.split("=")[0]?.trim();
            if (!cookieName) {
                return;
            }

            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });
    }

    function buildModal() {
        const modal = document.createElement("div");
        modal.className = "logout-confirm-modal";
        modal.id = "logoutConfirmModal";
        modal.hidden = true;
        modal.innerHTML = `
            <div class="logout-confirm-backdrop" data-role="close"></div>
            <div class="logout-confirm-card" role="dialog" aria-modal="true" aria-labelledby="logoutConfirmTitle">
                <h3 id="logoutConfirmTitle">Are you sure you want to log out?</h3>
                <p>Your current session will be cleared and you will be redirected to the login page.</p>
                <div class="logout-confirm-actions">
                    <button type="button" class="logout-confirm-btn logout-confirm-cancel" data-role="close">Cancel</button>
                    <button type="button" class="logout-confirm-btn logout-confirm-proceed" id="confirmLogoutBtn">Logout</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    const modal = buildModal();
    const closeControls = modal.querySelectorAll('[data-role="close"]');
    const confirmLogoutButton = modal.querySelector("#confirmLogoutBtn");

    function openModal() {
        modal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.hidden = true;
        document.body.style.overflow = "";
    }

    logoutBtn.addEventListener("click", openModal);
    closeControls.forEach(control => {
        control.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });

    confirmLogoutButton?.addEventListener("click", () => {
        localStorage.clear();
        sessionStorage.clear();
        clearAllCookies();
        window.location.href = "login.html";
    });
}

function initializePasswordToggle() {
    const passwordInput = document.getElementById("loginPassword");
    const passwordToggle = document.getElementById("passwordToggle");

    if (!passwordInput || !passwordToggle) {
        return;
    }

    passwordToggle.addEventListener("click", () => {
        const shouldShowPassword = passwordInput.type === "password";
        passwordInput.type = shouldShowPassword ? "text" : "password";
        passwordToggle.setAttribute("aria-pressed", String(shouldShowPassword));
        passwordToggle.setAttribute("aria-label", shouldShowPassword ? "Hide password" : "Show password");

        const icon = passwordToggle.querySelector("i");
        if (icon) {
            icon.className = shouldShowPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
        }
    });
}

// ── Navigation Guard ────────────────────────────────────────────────────────
// Locks the sidebar nav links until a valid session is detected.
// Session hint is stored in localStorage under STORAGE_KEYS.session.
function initializeNavGuard() {
    const navLinksContainer = document.getElementById("nav-links-container");
    const restrictedItems = document.querySelectorAll(".menu .restricted-access");
    const accountNavItem = document.getElementById("accountNavItem");
    const accountNavLabel = document.getElementById("accountNavLabel");
    const patientAccountLabels = document.querySelectorAll(".patient-account-label");

    if (!navLinksContainer && !restrictedItems.length) {
        return;
    }

    function isAuthenticated() {
        const userToken = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
        if (userToken) {
            return true;
        }

        const directFlag = String(localStorage.getItem("isLoggedIn") || sessionStorage.getItem("isLoggedIn") || "").toLowerCase();
        if (directFlag === "true" || directFlag === "1") {
            return true;
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEYS.session) || sessionStorage.getItem(STORAGE_KEYS.session);
            if (!raw) return false;
            const data = JSON.parse(raw);
            return data?.authed === true;
        } catch {
            return false;
        }
    }

    function getStoredRole() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.session) || sessionStorage.getItem(STORAGE_KEYS.session);
            if (!raw) return "";
            const data = JSON.parse(raw);
            return String(data?.role || "").toLowerCase();
        } catch {
            return "";
        }
    }

    const signOutBtn = document.getElementById("logoutBtn");

    function applyGuardState() {
        const authed = isAuthenticated();
        const role = getStoredRole();
        if (navLinksContainer) {
            navLinksContainer.classList.toggle("is-locked", !authed);
        }
        restrictedItems.forEach(item => {
            item.classList.toggle("restricted-access", !authed);
        });
        if (accountNavItem) {
            accountNavItem.dataset.page = "login.html";
            accountNavItem.hidden = authed;
        }
        if (accountNavLabel) {
            accountNavLabel.textContent = "Sign In";
        }
        if (patientAccountLabels.length && role === "patient") {
            patientAccountLabels.forEach(label => {
                label.textContent = "Account & Settings";
            });
        }
        if (signOutBtn) {
            signOutBtn.style.display = authed ? "" : "none";
        }
    }

    applyGuardState();

    // Sync guard if user logs in/out in another tab.
    window.addEventListener("storage", applyGuardState);

    // Gate the "Start Exercise" button — redirect to login when unauthenticated.
    const exerciseBtn = document.querySelector(".exercise-btn");
    if (exerciseBtn) {
        exerciseBtn.addEventListener("click", () => {
            if (!isAuthenticated()) {
                window.location.href = "login.html";
            } else {
                window.location.href = "exercise_hub.php";
            }
        });
    }
}

function initializeLoginForm() {
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginFormError");

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const formData = new FormData(loginForm);
        const identifier = String(formData.get("identifier") || "").trim();
        const password = String(formData.get("password") || "");

        if (!identifier || !password) {
            if (loginError) {
                loginError.textContent = "Please enter your username/email and password.";
            }
            return;
        }

        if (loginError) {
            loginError.textContent = "Signing in...";
        }

        try {
            const response = await fetch("api/login.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ identifier, password })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Invalid username/email or password.");
            }

            if (loginError) {
                loginError.textContent = "Login successful. Redirecting...";
            }

            // Store a session hint so the nav guard on static pages can check auth state.
            localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
                authed: true,
                role: payload.role || ""
            }));
            sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
                authed: true,
                role: payload.role || ""
            }));
            localStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("isLoggedIn", "true");
            const tokenSeed = `${payload.role || "user"}:${Date.now()}`;
            localStorage.setItem("userToken", tokenSeed);
            sessionStorage.setItem("userToken", tokenSeed);

            window.location.href = payload.redirect || "doctor_dashboard.php";
        } catch (error) {
            if (loginError) {
                const message = error instanceof Error ? error.message : "Unable to sign in right now.";
                loginError.textContent = /Failed to fetch/i.test(message)
                    ? "Cannot reach the server. Open the site via localhost and make sure Apache/MySQL are running in XAMPP."
                    : message;
            }
        }
    });
}

function initializeRegistrationWizard() {
    const wizardForm = document.getElementById("registrationWizard");
    const wizardStage = document.getElementById("registrationStage");
    const wizardError = document.getElementById("registrationWizardError");
    const progressCounter = document.getElementById("registrationStepCounter");
    const progressFill = document.querySelector(".registration-progress .progress-fill");
    const progressSteps = document.querySelectorAll(".registration-progress [data-progress-step]");
    const stepPanels = wizardForm ? Array.from(wizardForm.querySelectorAll(".form-step")) : [];

    if (!wizardForm || !wizardStage || !stepPanels.length) {
        return;
    }

    let currentStepIndex = 0;

    function normalizeContactNumber(value) {
        return String(value || "").replace(/\D/g, "").slice(0, 11);
    }

    function getFieldGroup(field) {
        return field.closest(".field-group");
    }

    function getFieldErrorNode(field) {
        const fieldGroup = getFieldGroup(field);
        return fieldGroup ? fieldGroup.querySelector(".field-error") : null;
    }

    function getFieldValidationMessage(field) {
        const value = field.value.trim();

        if (field.type === "file") {
            return "";
        }

        if (field.name === "contactNumber") {
            const digitsOnly = normalizeContactNumber(value);

            if (digitsOnly === "") {
                return "Contact number is required.";
            }

            if (!/^09\d{9}$/.test(digitsOnly)) {
                return "Enter a valid 11-digit contact number starting with 09.";
            }

            return "";
        }

        if (field.required && value === "") {
            return "This field is required.";
        }

        if (!field.checkValidity()) {
            return field.validationMessage || "Please enter a valid value.";
        }

        return "";
    }

    function setFieldValidationState(field) {
        const fieldGroup = getFieldGroup(field);
        const fieldError = getFieldErrorNode(field);
        const validationMessage = getFieldValidationMessage(field);
        const isInvalid = validationMessage !== "";

        if (fieldGroup) {
            fieldGroup.classList.toggle("is-invalid", isInvalid);
        }

        field.setAttribute("aria-invalid", isInvalid ? "true" : "false");

        if (fieldError) {
            fieldError.textContent = validationMessage;
        }

        return !isInvalid;
    }

    function clearStepValidation(stepIndex) {
        getRequiredFieldsForStep(stepIndex).forEach(field => {
            const fieldGroup = getFieldGroup(field);
            const fieldError = getFieldErrorNode(field);

            if (fieldGroup) {
                fieldGroup.classList.remove("is-invalid");
            }

            field.setAttribute("aria-invalid", "false");

            if (fieldError) {
                fieldError.textContent = "";
            }
        });
    }

    function getRequiredFieldsForStep(stepIndex) {
        const stepPanel = stepPanels[stepIndex];
        return stepPanel ? Array.from(stepPanel.querySelectorAll("input[required], select[required], textarea[required]")) : [];
    }

    function isFieldValid(field) {
        if (field.name === "contactNumber") {
            return getFieldValidationMessage(field) === "";
        }

        if (field.type === "file") {
            return true;
        }

        return field.value.trim() !== "" && field.checkValidity();
    }

    function isStepValid(stepIndex) {
        return getRequiredFieldsForStep(stepIndex).every(isFieldValid);
    }

    function updateStageHeight() {
        const activeStep = stepPanels[currentStepIndex];
        if (!activeStep) {
            return;
        }

        wizardStage.style.height = `${activeStep.offsetHeight}px`;
    }

    function updateStepButtons() {
        stepPanels.forEach((panel, panelIndex) => {
            const nextButton = panel.querySelector(".wizard-next");
            if (nextButton) {
                nextButton.disabled = false;
                nextButton.setAttribute("aria-disabled", "false");
            }
        });
    }

    function updateProgress() {
        if (progressCounter) {
            progressCounter.textContent = `Step ${currentStepIndex + 1} of ${stepPanels.length}`;
        }

        if (progressFill) {
            const progressRatio = ((currentStepIndex + 1) / stepPanels.length) * 100;
            progressFill.style.width = `${progressRatio}%`;
        }

        progressSteps.forEach((step, index) => {
            step.classList.toggle("is-active", index <= currentStepIndex);
        });
    }

    function renderStep(nextIndex) {
        currentStepIndex = nextIndex;

        stepPanels.forEach((panel, index) => {
            panel.classList.remove("is-active", "is-before", "is-after");

            if (index < currentStepIndex) {
                panel.classList.add("is-before");
            } else if (index > currentStepIndex) {
                panel.classList.add("is-after");
            } else {
                panel.classList.add("is-active");
            }
        });

        if (wizardError) {
            wizardError.textContent = "";
        }

        clearStepValidation(currentStepIndex);

        updateProgress();
        updateStepButtons();
        requestAnimationFrame(updateStageHeight);
    }

    function validateCurrentStep() {
        const requiredFields = getRequiredFieldsForStep(currentStepIndex);
        const firstInvalidField = requiredFields.find(field => !setFieldValidationState(field));

        if (!firstInvalidField) {
            if (wizardError) {
                wizardError.textContent = "";
            }
            return true;
        }

        if (wizardError) {
            const validationMessage = getFieldValidationMessage(firstInvalidField);
            wizardError.textContent = validationMessage
                ? `${validationMessage} Please correct the highlighted field before continuing.`
                : "Please complete all required fields before continuing.";
        }

        firstInvalidField.focus();
        return false;
    }

    stepPanels.forEach((panel, index) => {
        const nextButton = panel.querySelector(".wizard-next");
        const backButton = panel.querySelector(".wizard-back");
        const watchedFields = panel.querySelectorAll("input, select, textarea");

        watchedFields.forEach(field => {
            if (field.name === "contactNumber") {
                field.addEventListener("input", () => {
                    field.value = normalizeContactNumber(field.value);
                    setFieldValidationState(field);
                    if (wizardError && currentStepIndex === index) {
                        wizardError.textContent = "";
                    }
                    updateStepButtons();
                });

                field.addEventListener("blur", () => {
                    setFieldValidationState(field);
                });

                return;
            }

            field.addEventListener("input", updateStepButtons);
            field.addEventListener("change", () => {
                setFieldValidationState(field);
                if (wizardError && currentStepIndex === index) {
                    wizardError.textContent = "";
                }
                updateStepButtons();
            });
            field.addEventListener("blur", () => {
                setFieldValidationState(field);
            });
        });

        if (nextButton) {
            nextButton.addEventListener("click", () => {
                if (!validateCurrentStep()) {
                    updateStepButtons();
                    return;
                }

                renderStep(Math.min(index + 1, stepPanels.length - 1));
            });
        }

        if (backButton) {
            backButton.addEventListener("click", () => {
                renderStep(Math.max(index - 1, 0));
            });
        }
    });

    wizardForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!validateCurrentStep()) {
            return;
        }

        const submitButton = wizardForm.querySelector(".registration-submit");
        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }

        if (wizardError) {
            wizardError.textContent = "Creating your account...";
        }

        const formData = new FormData(wizardForm);
        const payload = {
            fullName: String(formData.get("fullName") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            contactNumber: String(formData.get("contactNumber") || "").trim(),
            specialty: String(formData.get("specialty") || "").trim(),
            specialtyOther: String(formData.get("specialtyOther") || "").trim(),
            licenseNumber: String(formData.get("licenseNumber") || "").trim(),
            yearsOfExperience: Number(formData.get("yearsOfExperience") || 0),
            affiliation: String(formData.get("affiliation") || "").trim(),
            username: String(formData.get("username") || "").trim(),
            password: String(formData.get("password") || ""),
            bio: String(formData.get("bio") || "").trim()
        };

        try {
            const response = await fetch("api/registration.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                throw new Error(result.error || "Registration failed.");
            }

            if (wizardError) {
                wizardError.textContent = "Registration successful. Redirecting to login...";
            }

            setTimeout(() => {
                window.location.href = "login.html";
            }, 700);
        } catch (error) {
            if (wizardError) {
                const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
                wizardError.textContent = /Failed to fetch/i.test(message)
                    ? "Cannot reach the server. Open the site via localhost and make sure Apache/MySQL are running in XAMPP."
                    : message;
            }
        } finally {
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });

    renderStep(0);
    window.addEventListener("resize", updateStageHeight);
}

function initializeSpecialtyOtherField() {
    const specialtySelect = document.querySelector('select[name="specialty"]');
    const specialtyOtherField = document.getElementById("specialtyOtherField");
    const specialtyOtherInput = document.getElementById("specialtyOtherInput");

    if (!specialtySelect || !specialtyOtherField || !specialtyOtherInput) {
        return;
    }

    function syncSpecialtyOtherState() {
        const isOtherSelected = specialtySelect.value === "other";
        specialtyOtherField.classList.toggle("is-hidden", !isOtherSelected);
        specialtyOtherInput.disabled = !isOtherSelected;
        specialtyOtherInput.required = isOtherSelected;

        specialtyOtherInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    specialtySelect.addEventListener("change", syncSpecialtyOtherState);
    syncSpecialtyOtherState();
}

if (pinToggle && sidebar) {
    const storedPinned = localStorage.getItem(STORAGE_KEYS.pinned) === "true";
    applyPinnedState(storedPinned);
    updateActiveIndicator();

    pinToggle.addEventListener("click", () => {
        const pinnedNow = !sidebar.classList.contains("is-pinned");
        applyPinnedState(pinnedNow);
        localStorage.setItem(STORAGE_KEYS.pinned, String(pinnedNow));
        updateActiveIndicator();
    });
}

if (themeToggle) {
    const storedDark = localStorage.getItem(STORAGE_KEYS.darkMode) === "true";
    applyTheme(storedDark);

    themeToggle.addEventListener("click", () => {
        const darkNow = !document.body.classList.contains("dark-mode");
        applyTheme(darkNow);
        localStorage.setItem(STORAGE_KEYS.darkMode, String(darkNow));
    });
}

if (calendarPrev && calendarNext) {
    calendarPrev.addEventListener("click", () => {
        calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
        renderCalendar();
    });

    calendarNext.addEventListener("click", () => {
        calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
        renderCalendar();
    });
}

initializePatientDashboardVisuals();
initializeCharts();
renderCalendar();
loadCalendarPlan();
updateActiveIndicator();
initializeRootAuthGuard();
bindSidebarMotionSync();
initializePasswordToggle();
initializeLoginForm();
initializeRegistrationWizard();
initializeSpecialtyOtherField();
initializeDoctorDashboard();
initializePatientsPage();
initializeTherapyPlansPage();
initializeGlobalProgressPage();
initializeMessagesPage();
initializeExerciseHubPage();
initializeRecoveryPage();
initializePatientMessagesPage();
initializePatientSettingsPage();
initializeSettingsPage();
initializeLogoutFlow();
initializeNavGuard();

window.addEventListener("resize", updateActiveIndicator);