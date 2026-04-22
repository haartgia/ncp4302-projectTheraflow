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
            const hasHandshakeFlag = data && Object.prototype.hasOwnProperty.call(data, "handshakeOnline");
            const isOnline = hasHandshakeFlag ? Boolean(data.handshakeOnline) : Boolean(data && data.connected);

            if (!data || !isOnline) {
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
    const input = (typeof daysCompleted === "object" && daysCompleted !== null)
        ? daysCompleted
        : { consecutiveDays: Number(daysCompleted || 0), weekCompletedMondayFirst: [] };

    const consecutiveDays = Math.max(0, Number(input.consecutiveDays || 0));
    const weekCompletedMondayFirst = Array.isArray(input.weekCompletedMondayFirst)
        ? input.weekCompletedMondayFirst.slice(0, streakDots.length).map(Boolean)
        : [];

    const streakTrack = document.getElementById("streakTrack");
    const today = new Date();
    const todayMondayIndex = (today.getDay() + 6) % 7;
    const completedTodayOrEarlierIndexes = [];

    const maxSegments = Math.max(1, streakDots.length - 1);

    streakDots.forEach((dot, index) => {
        const isPastOrToday = index <= todayMondayIndex;
        const isCompleted = isPastOrToday && Boolean(weekCompletedMondayFirst[index]);
        const isToday = index === todayMondayIndex;
        const isTodayCompleted = isToday && isCompleted;

        dot.classList.toggle("is-completed", isCompleted);
        // Only light/glow today's node when therapy data for today is recorded.
        dot.classList.toggle("active", isTodayCompleted);
        dot.classList.toggle("is-today", isTodayCompleted);

        if (isCompleted) {
            completedTodayOrEarlierIndexes.push(index);
        }
    });

    const farthestCompletedIndex = completedTodayOrEarlierIndexes.length
        ? Math.max(...completedTodayOrEarlierIndexes)
        : -1;
    const completedSegments = Math.max(0, farthestCompletedIndex);
    const progressPercent = (completedSegments / maxSegments) * 100;
    const hasAtLeastTwoLit = completedTodayOrEarlierIndexes.length >= 2;

    if (streakTrack) {
        streakTrack.style.setProperty("--streak-progress", `${hasAtLeastTwoLit ? progressPercent : 0}%`);
        streakTrack.classList.toggle("is-glow-active", hasAtLeastTwoLit);
    }

    if (streakBadge) {
        streakBadge.classList.toggle("active", consecutiveDays > 0);
        streakBadge.innerHTML = `<i class="fa-solid fa-fire"></i> ${consecutiveDays} day${consecutiveDays === 1 ? "" : "s"}`;
    }
}

function initializePatientDashboardVisuals() {
    const homeGreeting = document.getElementById("homeGreeting");
    const completionRing = document.getElementById("patientCompletionRing");
    const completionValue = document.getElementById("patientCompletionValue");
    const completionLabel = document.querySelector(".patient-progress-label");
    const nextExerciseReps = document.getElementById("nextExerciseReps");
    const nextExerciseStartBtn = document.getElementById("nextExerciseStartBtn") || document.querySelector(".exercise-btn");
    const nextExerciseRefreshBtn = document.getElementById("nextExerciseRefreshBtn");
    const nextExerciseDeviceOffline = document.getElementById("nextExerciseDeviceOffline");
    const nextExerciseDeviceOnline = document.getElementById("nextExerciseDeviceOnline");
    const nextExerciseSignalLabel = document.getElementById("nextExerciseSignalLabel");
    const nextExerciseBatteryLevel = document.getElementById("nextExerciseBatteryLevel");
    const nextExerciseBatteryIcon = document.getElementById("nextExerciseBatteryIcon");
    const gloveStatusBadge = document.getElementById("gloveStatusBadge");
    const actionRings = document.querySelectorAll("[data-progress-ring]");
    const metricCards = {
        grip: document.querySelector('[data-progress-kind="grip"]')?.closest(".metric-strip") || null,
        finger: document.querySelector('[data-progress-kind="finger"]')?.closest(".metric-strip") || null,
        repetitions: document.querySelector('[data-progress-kind="repetitions"]')?.closest(".metric-strip") || null,
        duration: document.querySelector('[data-progress-kind="duration"]')?.closest(".metric-strip") || null
    };
    const daySubheader = document.querySelector(".header-left .subheader");
    const nextExerciseDescription = document.getElementById("nextExerciseDescription");
    let latestHandshakeState = false;
    let streakState = {
        consecutiveDays: 0,
        weekCompletedMondayFirst: new Array(streakDots.length).fill(false),
        fetchedAt: 0
    };

    if (!completionRing && !actionRings.length && !daySubheader && !nextExerciseDescription) {
        return;
    }

    function firstNameFromText(value) {
        const normalized = String(value || "").trim();
        if (!normalized || /^not provided$/i.test(normalized)) {
            return "";
        }

        const parts = normalized.split(/\s+/).filter(Boolean);
        return parts.length ? parts[0] : "";
    }

    function applyGreeting(firstName) {
        if (!homeGreeting) return;
        const safeFirstName = firstNameFromText(firstName);
        homeGreeting.textContent = safeFirstName ? `Hello, ${safeFirstName}!` : "Hello, Patient!";
    }

    async function refreshHomeGreeting() {
        if (!homeGreeting) return;
        try {
            const response = await fetch("api/patient/profile.php", {
                method: "GET",
                headers: { "Accept": "application/json" },
                cache: "no-store"
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error("Unable to load patient profile");
            }

            const firstName = firstNameFromText(payload?.profile?.full_name);
            applyGreeting(firstName);
        } catch {
            applyGreeting("");
        }
    }

    function readGloveState() {
        try {
            const raw = localStorage.getItem("theraflow_glove");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function batteryIconForPercent(percent) {
        if (percent >= 85) return "fa-solid fa-battery-full";
        if (percent >= 60) return "fa-solid fa-battery-three-quarters";
        if (percent >= 35) return "fa-solid fa-battery-half";
        if (percent >= 15) return "fa-solid fa-battery-quarter";
        return "fa-solid fa-battery-empty";
    }

    function signalLabelFromState(gloveState) {
        const rssi = Number(gloveState.rssi || gloveState.signal || 0);
        if (!Number.isFinite(rssi) || rssi === 0) {
            return "Wi-Fi";
        }
        if (rssi >= -60) return "Strong";
        if (rssi >= -72) return "Good";
        if (rssi >= -84) return "Fair";
        return "Weak";
    }

    function applyDevicePanelState(isHandshakeOnline) {
        const gloveState = readGloveState();
        const battery = Math.max(0, Math.min(100, Number(gloveState.batteryPercent ?? gloveState.battery ?? 0)));

        if (nextExerciseDeviceOffline) {
            nextExerciseDeviceOffline.hidden = isHandshakeOnline;
        }
        if (nextExerciseDeviceOnline) {
            nextExerciseDeviceOnline.hidden = !isHandshakeOnline;
        }

        if (nextExerciseSignalLabel) {
            nextExerciseSignalLabel.textContent = signalLabelFromState(gloveState);
        }

        if (nextExerciseBatteryLevel) {
            nextExerciseBatteryLevel.textContent = battery > 0 ? `${Math.round(battery)}%` : "--%";
        }

        if (nextExerciseBatteryIcon) {
            nextExerciseBatteryIcon.className = batteryIconForPercent(battery);
        }

        if (gloveStatusBadge) {
            const icon = gloveStatusBadge.querySelector("i");
            const label = gloveStatusBadge.querySelector("span");
            if (!isHandshakeOnline) {
                gloveStatusBadge.className = "glove-status-badge is-offline";
                if (icon) icon.className = "fa-solid fa-circle-xmark";
                if (label) label.textContent = "Glove Offline";
            } else if (Boolean(gloveState.sessionActive)) {
                gloveStatusBadge.className = "glove-status-badge is-active";
                if (icon) icon.className = "fa-solid fa-circle-dot";
                if (label) label.textContent = `Session Active - ${Number(gloveState.sessionReps || 0)} reps`;
            } else {
                gloveStatusBadge.className = "glove-status-badge is-connected";
                if (icon) icon.className = "fa-solid fa-circle-check";
                if (label) label.textContent = "Glove Connected";
            }
        }
    }

    function applyProgressRing(element, percent) {
        const clampedPercent = Math.max(0, Math.min(Number(percent) || 0, 100));
        element.style.setProperty("--progress", String(clampedPercent));
        element.dataset.progressText = `${Math.round(clampedPercent)}% done`;
        element.setAttribute("aria-label", `${Math.round(clampedPercent)} percent complete`);
    }

    function setMetricStatus(metricKey, state, valueText, labelText) {
        const card = metricCards[metricKey];
        if (!card) return;

        const valueEl = card.querySelector(".patient-action-value");
        const labelEl = card.querySelector(".widget-label");

        card.classList.remove("status-no-data", "status-waiting", "status-active");
        card.classList.add(`status-${state}`);

        if (valueEl) {
            valueEl.textContent = valueText;
        }

        if (labelEl) {
            labelEl.textContent = labelText;
        }
    }

    function refreshDashboardVisuals() {
        const gloveState = readGloveState();
        const gloveConnected = Boolean(gloveState.connected);
        const sessionReps = Math.max(0, Number(gloveState.sessionReps || 0));
        const sessionMinutes = Math.max(0, Number(gloveState.sessionMinutes || gloveState.durationMin || 0));
        const targetRepetitions = Math.max(1, Number(gloveState.targetRepetitions || 120));
        const completionPercent = Math.round((sessionReps / targetRepetitions) * 100);
        const weekCompleted = Array.isArray(streakState.weekCompletedMondayFirst)
            ? streakState.weekCompletedMondayFirst.slice(0, streakDots.length).map(Boolean)
            : new Array(streakDots.length).fill(false);

        // Keep streak strictly based on backend-recorded sessions.
        const streakDays = Math.max(0, Number(streakState.consecutiveDays || 0));

        initializeStreak({
            consecutiveDays: streakDays,
            weekCompletedMondayFirst: weekCompleted
        });

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

        const liveMovementDeg = Number(gloveState.sessionMovementDeg ?? gloveState.lastMovementDeg ?? NaN);
        const hasLiveMovement = Number.isFinite(liveMovementDeg) && liveMovementDeg >= 0;
        const estimatedDuration = sessionMinutes > 0
            ? sessionMinutes
            : (sessionReps > 0 ? Math.max(1, Math.round(sessionReps / 8)) : 0);

        if (sessionReps > 0) {
            setMetricStatus("grip", "active", `${completionPercent}%`, "Grip performance updated today.");
            if (hasLiveMovement) {
                setMetricStatus("finger", "active", `${liveMovementDeg.toFixed(1)}°`, "Live finger movement from glove flexion.");
            } else {
                setMetricStatus("finger", "waiting", "Waiting for Data...", "Move your hand to capture finger movement.");
            }
            setMetricStatus("repetitions", "active", String(sessionReps), `${Math.max(0, targetRepetitions - sessionReps)} reps remaining today.`);
            setMetricStatus("duration", "active", `${estimatedDuration} min`, "Session duration updated from activity.");
            return;
        }

        if (gloveConnected) {
            setMetricStatus("grip", "waiting", "Waiting for Data...", "Perform an exercise to update.");
            if (hasLiveMovement) {
                setMetricStatus("finger", "active", `${liveMovementDeg.toFixed(1)}°`, "Latest finger movement from glove.");
            } else {
                setMetricStatus("finger", "waiting", "Waiting for Data...", "Perform an exercise to update.");
            }
            setMetricStatus("repetitions", "waiting", "0", "Waiting for your first set today.");
            setMetricStatus("duration", "waiting", "0 min", "Waiting for your first session today.");
            return;
        }

        setMetricStatus("grip", "no-data", "--", "No data recorded today.");
        if (hasLiveMovement) {
            setMetricStatus("finger", "active", `${liveMovementDeg.toFixed(1)}°`, "Latest recorded finger movement.");
        } else {
            setMetricStatus("finger", "no-data", "--", "No data recorded today.");
        }
        setMetricStatus("repetitions", "no-data", "0", "No data recorded today.");
        setMetricStatus("duration", "no-data", "0 min", "No data recorded today.");
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
            if (nextExerciseReps) {
                nextExerciseReps.textContent = `Target: ${targetReps > 0 ? targetReps : "--"} reps`;
            }
            if (!hasPlan && payload.source === "default") {
                nextExerciseDescription.textContent = "No doctor plan yet — calibrate first to generate your first session.";
                return;
            }

            nextExerciseDescription.textContent = `${exerciseType} session${repsCopy}, estimated ${duration} minutes`;
        } catch {
            if (nextExerciseReps) {
                nextExerciseReps.textContent = "Target: -- reps";
            }
            // Keep default copy if plan isn't available (e.g., not signed in yet).
        }
    }

    async function refreshHandshakeState() {
        try {
            const response = await fetch("api/iot/handshake_status.php", { cache: "no-store" });
            const payload = await response.json().catch(() => ({}));
            latestHandshakeState = Boolean(response.ok && payload?.ok && payload?.handshake === true);
        } catch {
            latestHandshakeState = false;
        }

        try {
            const gloveState = readGloveState();
            gloveState.handshakeOnline = latestHandshakeState;
            gloveState.connected = latestHandshakeState;
            localStorage.setItem("theraflow_glove", JSON.stringify(gloveState));
        } catch {
            // Ignore storage failures (private mode or quota restrictions).
        }

        applyDevicePanelState(latestHandshakeState);
    }

    async function refreshStreakFromBackend(force = false) {
        const now = Date.now();
        if (!force && now - Number(streakState.fetchedAt || 0) < 60000) {
            return;
        }

        try {
            const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
            const response = await fetch(`api/patient/recovery.php?tz=${tz}`, { credentials: "same-origin", cache: "no-store" });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload?.ok) {
                throw new Error("Unable to load streak data.");
            }

            const streak = payload?.streak || {};
            streakState = {
                consecutiveDays: Math.max(0, Number(streak.consecutiveDays || 0)),
                weekCompletedMondayFirst: Array.isArray(streak.weekCompletedMondayFirst)
                    ? streak.weekCompletedMondayFirst.slice(0, streakDots.length).map(Boolean)
                    : new Array(streakDots.length).fill(false),
                fetchedAt: now
            };
        } catch {
            streakState = {
                ...streakState,
                fetchedAt: now
            };
        }

        refreshDashboardVisuals();
    }

    refreshDashboardVisuals();
    void refreshHomeGreeting();
    void refreshNextExercise();
    void refreshHandshakeState();
    void refreshStreakFromBackend(true);

    nextExerciseRefreshBtn?.addEventListener("click", () => {
        void refreshHandshakeState();
    });

    window.addEventListener("storage", () => {
        refreshDashboardVisuals();
        applyDevicePanelState(latestHandshakeState);
        void refreshStreakFromBackend(true);
    });

    setInterval(refreshDashboardVisuals, 3000);
    setInterval(() => {
        void refreshHandshakeState();
    }, 5000);
    setInterval(() => {
        void refreshStreakFromBackend();
    }, 60000);
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

function initializeMetricGraphModal() {
    const modal = document.getElementById("metricGraphModal");
    const modalClose = document.getElementById("metricGraphModalClose");
    const modalTitle = document.getElementById("metricGraphModalTitle");
    const canvas = document.getElementById("metricGraphCanvas");
    const description = document.getElementById("metricGraphDescription");
    const moreDetailBtn = document.getElementById("metricGraphMoreDetail");
    const showValuesToggle = document.getElementById("metricGraphShowValues");
    const modalFoot = modal?.querySelector(".metric-graph-modal-foot") || null;
    const graphButtons = document.querySelectorAll(".metric-graph-btn[data-metric-id]");

    if (!modal || !canvas || !graphButtons.length || typeof Chart === "undefined") {
        return;
    }

    let modalChart = null;
    let activeMetricId = "grip";
    let cachedRecentSessions = null;
    let showPointValues = showValuesToggle ? Boolean(showValuesToggle.checked) : true;
    const chartFontFamily = '"Poppins", "Segoe UI", sans-serif';

    function formatLongDate(dateValue) {
        return dateValue.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric"
        });
    }

    function formatSessionNumberLabel(index) {
        return `S${index + 1}`;
    }

    function getDescription(metricId) {
        const descriptions = {
            grip: "This shows how much strength you have when squeezing the glove.",
            finger: "This shows how far you can bend your fingers today.",
            repetitions: "This tracks how many times you completed the movement.",
            duration: "This shows the total time you spent exercising."
        };
        return `${descriptions[metricId] || descriptions.grip} Based on your last 7 recent sessions.`;
    }

    async function fetchLastSevenRecentSessions() {
        if (Array.isArray(cachedRecentSessions)) {
            return cachedRecentSessions;
        }

        const response = await fetch("api/patient/recovery.php", { credentials: "same-origin" });
        if (!response.ok) {
            throw new Error("Unable to load session data.");
        }

        const payload = await response.json().catch(() => ({}));
        const rawLogs = Array.isArray(payload?.logs) ? payload.logs : [];

        const ordered = rawLogs
            .map(log => {
                const ts = new Date(String(log?.timestamp || ""));
                return {
                    ...log,
                    __ts: Number.isNaN(ts.getTime()) ? 0 : ts.getTime()
                };
            })
            .sort((a, b) => b.__ts - a.__ts)
            .slice(0, 7)
            .sort((a, b) => a.__ts - b.__ts);

        cachedRecentSessions = ordered;
        return ordered;
    }

    function buildMetricSeries(metricId, sessions) {
        const safeSessions = Array.isArray(sessions) && sessions.length ? sessions : [];

        const labels = safeSessions.length
            ? safeSessions.map((_, index) => formatSessionNumberLabel(index))
            : ["S1"];

        const dates = safeSessions.length
            ? safeSessions.map(session => {
                const stamp = new Date(String(session?.timestamp || ""));
                return Number.isNaN(stamp.getTime()) ? "Unknown date" : formatLongDate(stamp);
            })
            : ["Unknown date"];

        const valueReaders = {
            grip: session => Number(session?.grip_strength || 0),
            finger: session => Number(session?.finger_movement || session?.flexion_angle || 0),
            repetitions: session => Number(session?.repetitions || 0),
            duration: session => {
                const durationSec = Number(session?.duration_sec || 0);
                return durationSec > 0 ? durationSec / 60 : Number(session?.duration_min || 0);
            }
        };

        const seriesByMetric = {
            grip: {
                title: "Grip Strength Trend",
                label: "Force (N)",
                yAxisTitle: "Force (N)",
                unit: " N"
            },
            finger: {
                title: "Finger Movement Trend",
                label: "Range of Motion (deg)",
                yAxisTitle: "Range of Motion (deg)",
                unit: "\u00b0"
            },
            repetitions: {
                title: "Repetitions Trend",
                label: "Repetitions",
                yAxisTitle: "Repetitions",
                unit: " reps"
            },
            duration: {
                title: "Session Duration Trend",
                label: "Minutes",
                yAxisTitle: "Minutes",
                unit: " min"
            }
        };

        const selected = seriesByMetric[metricId] || seriesByMetric.grip;
        const reader = valueReaders[metricId] || valueReaders.grip;
        const values = safeSessions.length
            ? safeSessions.map(reader)
            : [0];

        return {
            labels,
            ...selected,
            values,
            dates
        };
    }

    async function openModal(metricId) {
        const sessions = await fetchLastSevenRecentSessions().catch(() => []);
        const series = buildMetricSeries(metricId, sessions);
        activeMetricId = metricId;
        modalTitle.textContent = series.title;
        if (description) {
            description.textContent = getDescription(metricId);
        }

        const showMoreDetail = metricId === "grip" || metricId === "finger";
        if (moreDetailBtn) {
            moreDetailBtn.hidden = !showMoreDetail;
        }
        if (modalFoot) {
            modalFoot.hidden = !showMoreDetail;
        }

        if (modalChart) {
            modalChart.destroy();
        }

        const axisColor = "#374151";
        const gridColor = "rgba(107, 114, 128, 0.2)";
        const context = canvas.getContext("2d");
        const lineColor = "#4d869c";
        const fillGradient = context
            ? (() => {
                const gradient = context.createLinearGradient(0, 0, 0, canvas.height || 280);
                gradient.addColorStop(0, "rgba(77, 134, 156, 0.34)");
                gradient.addColorStop(1, "rgba(77, 134, 156, 0.05)");
                return gradient;
            })()
            : "rgba(77, 134, 156, 0.18)";

        const latestPointGlowPlugin = {
            id: "latestPointGlow",
            afterDatasetsDraw(chart) {
                const points = chart.getDatasetMeta(0)?.data || [];
                const latestPoint = points[points.length - 1];
                if (!latestPoint) {
                    return;
                }

                const ctx = chart.ctx;
                ctx.save();
                ctx.shadowColor = "rgba(77, 134, 156, 0.45)";
                ctx.shadowBlur = 12;
                ctx.fillStyle = "rgba(77, 134, 156, 0.20)";
                ctx.beginPath();
                ctx.arc(latestPoint.x, latestPoint.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        const pointDataLabelPlugin = {
            id: "pointDataLabelPlugin",
            afterDatasetsDraw(chart) {
                if (!showPointValues) {
                    return;
                }

                const ctx = chart.ctx;
                const points = chart.getDatasetMeta(0)?.data || [];

                ctx.save();
                ctx.fillStyle = "#374151";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.font = `600 12px ${chartFontFamily}`;

                points.forEach((point, index) => {
                    const raw = Number(series.values[index] || 0);
                    const textValue = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
                    const label = `${textValue}${series.unit}`;
                    ctx.fillText(label, point.x, point.y - 10);
                });

                ctx.restore();
            }
        };

        modalChart = new Chart(canvas, {
            type: "line",
            data: {
                labels: series.labels,
                datasets: [{
                    label: series.label,
                    data: series.values,
                    borderColor: lineColor,
                    backgroundColor: fillGradient,
                    fill: true,
                    tension: 0.3,
                    pointRadius: context => (context.dataIndex === series.values.length - 1 ? 10 : 7),
                    pointHoverRadius: context => (context.dataIndex === series.values.length - 1 ? 13 : 11),
                    pointHitRadius: 18,
                    pointBorderWidth: 2,
                    pointBackgroundColor: "#ffffff",
                    pointBorderColor: lineColor
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 16,
                        right: 14,
                        left: 10,
                        bottom: 6
                    }
                },
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: axisColor,
                            font: {
                                family: chartFontFamily,
                                size: 16,
                                weight: "600"
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        titleFont: {
                            family: chartFontFamily,
                            size: 14,
                            weight: "600"
                        },
                        bodyFont: {
                            family: chartFontFamily,
                            size: 14,
                            weight: "500"
                        },
                        callbacks: {
                            title(items) {
                                const idx = items[0]?.dataIndex ?? 0;
                                return `Date: ${series.dates[idx]}`;
                            },
                            label(context) {
                                const raw = Number(context.raw || 0);
                                const value = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
                                return `${value}${series.unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Session Number",
                            color: axisColor,
                            font: {
                                family: chartFontFamily,
                                size: 16,
                                weight: "700"
                            }
                        },
                        ticks: {
                            color: axisColor,
                            font: {
                                family: chartFontFamily,
                                size: 15,
                                weight: "500"
                            },
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            padding: 10
                        },
                        grid: { color: gridColor }
                    },
                    y: {
                        beginAtZero: true,
                        min: 0,
                        title: {
                            display: true,
                                family: chartFontFamily,
                            text: series.yAxisTitle,
                            color: axisColor,
                            font: {
                                size: 16,
                                weight: "700"
                            }
                        },
                                family: chartFontFamily,
                        ticks: {
                            color: axisColor,
                            font: {
                                size: 15,
                                weight: "500"
                            }
                        },
                        grid: { color: gridColor }
                    }
                }
            },
            plugins: [latestPointGlowPlugin, pointDataLabelPlugin]
        });

        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("graph-modal-open");
    }

    function closeModal() {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("graph-modal-open");
    }

    graphButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const metricId = button.getAttribute("data-metric-id") || "grip";
            openModal(metricId).catch(() => {
                if (description) {
                    description.textContent = `Unable to load recent session data. Based on your last 7 recent sessions.`;
                }
            });
        });
    });

    modal.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.modalClose === "true") {
            closeModal();
        }
    });

    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }

    if (moreDetailBtn) {
        moreDetailBtn.addEventListener("click", () => {
            const metricParam = encodeURIComponent(activeMetricId || "grip");
            window.location.href = `recover.php?view=${metricParam}`;
        });
    }

    showValuesToggle?.addEventListener("change", () => {
        showPointValues = Boolean(showValuesToggle.checked);
        if (!modal.hidden) {
            openModal(activeMetricId).catch(() => {
                if (description) {
                    description.textContent = `Unable to load recent session data. Based on your last 7 recent sessions.`;
                }
            });
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });
}

function initializeDoctorDashboard() {
    const doctorChartCanvas = document.getElementById("doctorWeeklyProgressChart");
    const totalPatientsEl = document.getElementById("dashboardTotalPatients");
    const sessionsTodayEl = document.getElementById("dashboardSessionsToday");
    const avgGripEl = document.getElementById("dashboardAvgGripStrength");
    const avgRangeEl = document.getElementById("dashboardAvgRangeMotion");
    const recentActivityBody = document.getElementById("dashboardRecentActivityBody");
    const quickOverviewBody = document.getElementById("dashboardQuickOverviewBody");
    const recentActivityEmpty = document.getElementById("dashboardRecentActivityEmpty");
    const quickOverviewEmpty = document.getElementById("dashboardQuickOverviewEmpty");
    const chartWrap = document.getElementById("doctorChartWrap");
    const metricButtons = document.querySelectorAll(".chart-metric-toggle .metric-btn");
    const periodButtons = document.querySelectorAll(".chart-period-toggle .period-btn");
    const showValuesToggle = document.getElementById("doctorChartShowValues");
    const chartTitle = document.getElementById("doctorChartTitle");
    const chartSubtitle = document.getElementById("doctorChartSubtitle");
    const chartEmpty = document.getElementById("doctorChartEmpty");
    const patientSelectBtn = document.getElementById("patientSelectBtn");
    const patientSelectMenu = document.getElementById("patientSelectMenu");
    const patientSelectList = document.getElementById("patientSelectList");
    const patientSelectSearch = document.getElementById("patientSelectSearch");
    const selectedPatientLabel = document.getElementById("selectedPatientLabel");

    if (!document.body.classList.contains("doctor-dashboard-page")) {
        return;
    }

    const doctorHeaderDateEl = document.querySelector(".doctor-header-date");
    if (doctorHeaderDateEl) {
        const now = new Date();
        doctorHeaderDateEl.textContent = now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    let doctorChart = null;
    let cachedPayload = null;
    let activeMetric = "grip";
    let activePeriod = "weekly";
    let showChartValues = Boolean(showValuesToggle?.checked);
    let selectedPatientKey = "all";
    let patientOptions = [];
    let refreshTimer = null;
    const defaultAssessmentStageName = "Initial Baseline";

    function safeText(value, fallback = "-") {
        const normalized = value === null || value === undefined ? "" : String(value).trim();
        return normalized || fallback;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function toggleEmptyState(emptyNode, isVisible) {
        if (!emptyNode) return;
        emptyNode.hidden = !isVisible;
        const wrap = emptyNode.closest(".doctor-table-wrap");
        if (wrap) {
            wrap.classList.toggle("is-empty", isVisible);
        }
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

    function getChartByActivePeriod(payload) {
        if (activePeriod === "daily") {
            return payload?.dailyChart || payload?.weeklyChart || {};
        }

        if (activePeriod === "monthly") {
            return payload?.monthlyChart || payload?.weeklyChart || {};
        }

        return payload?.weeklyChart || {};
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
        const isRangeMetric = activeMetric === "range";
        const metricLabel = isRangeMetric ? "Range of Motion (deg)" : "Grip Strength (N)";
        const lineColor = isRangeMetric ? "#2d6a4f" : "#0d5f73";
        const fillColor = isRangeMetric ? "rgba(45,106,79,0.18)" : "rgba(13,95,115,0.14)";
        const metricData = Array.isArray(resolved.series) ? resolved.series : [];
        const hasData = hasDataPoints(metricData);
        if (chartEmpty) {
            chartEmpty.hidden = hasData;
        }
        const yBounds = computeYAxisBounds(metricData);

        const valueLabelPlugin = {
            id: "doctorDashboardPointValueLabels",
            afterDatasetsDraw(chartInstance) {
                if (!showChartValues) {
                    return;
                }

                const ctx = chartInstance.ctx;
                const dataset = chartInstance.data?.datasets?.[0];
                const points = chartInstance.getDatasetMeta(0)?.data || [];
                const values = Array.isArray(dataset?.data) ? dataset.data : [];

                ctx.save();
                ctx.fillStyle = document.body.classList.contains("dark-mode") ? "#d9ebf3" : "#36505e";
                ctx.font = "700 12px Inter, Public Sans, Segoe UI, sans-serif";
                ctx.textAlign = "center";

                points.forEach((point, index) => {
                    const raw = Number(values[index]);
                    if (!Number.isFinite(raw) || raw <= 0) {
                        return;
                    }

                    ctx.fillText(raw.toFixed(1), point.x, point.y - 10);
                });

                ctx.restore();
            }
        };

        doctorChart = new Chart(doctorChartCanvas, {
            type: "line",
            data: {
                labels: Array.isArray(resolved.labels) ? resolved.labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [
                    {
                        label: metricLabel,
                        data: metricData.length ? metricData : [0, 0, 0, 0, 0, 0, 0],
                        borderColor: lineColor,
                        backgroundColor: fillColor,
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 5
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
            },
            plugins: [valueLabelPlugin]
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

    function syncPatientOptions(payload) {
        const fromPayload = Array.isArray(payload?.patients) ? payload.patients : [];
        patientOptions = [
            { key: "all", label: "All Patients (Avg)" },
            ...fromPayload.map(patient => ({
                key: String(patient.id),
                label: safeText(patient.name, `Patient ${patient.id}`)
            }))
        ];

        if (selectedPatientKey !== "all" && !patientOptions.some(option => option.key === selectedPatientKey)) {
            selectedPatientKey = "all";
            if (selectedPatientLabel) {
                selectedPatientLabel.textContent = "All Patients (Avg)";
            }
        }

        renderPatientSelector();
    }

    function updateChartTitle() {
        const periodTitleMap = {
            daily: "Daily",
            weekly: "Weekly",
            monthly: "Monthly"
        };

        const periodLabel = periodTitleMap[activePeriod] || "Weekly";
        const activeLabel = patientOptions.find(item => item.key === selectedPatientKey)?.label || "All Patients (Avg)";
        if (chartTitle) {
            chartTitle.textContent = `Patient Therapy Progress (${periodLabel})`;
        }
        if (chartSubtitle) {
            chartSubtitle.textContent = `${periodLabel} Progress: ${activeLabel}`;
        }
    }

    function formatActivityTimestamp(timestamp) {
        const raw = String(timestamp || "").trim();
        if (!raw) {
            return "-";
        }

        const parsedDate = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
        if (Number.isNaN(parsedDate.getTime())) {
            return raw;
        }

        const now = Date.now();
        const diffSec = Math.max(0, Math.floor((now - parsedDate.getTime()) / 1000));
        if (diffSec < 60) {
            return "just now";
        }
        if (diffSec < 3600) {
            const mins = Math.floor(diffSec / 60);
            return `${mins} ${mins === 1 ? "min" : "mins"} ago`;
        }
        if (diffSec < 86400) {
            const hours = Math.floor(diffSec / 3600);
            return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
        }

        return parsedDate.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
    }

    function renderDashboard(payload) {
        cachedPayload = payload;
        syncPatientOptions(payload);
        const summary = payload.summary || {};
        if (totalPatientsEl) totalPatientsEl.textContent = String(summary.totalPatients ?? 0);
        if (sessionsTodayEl) sessionsTodayEl.textContent = String(summary.sessionsToday ?? 0);
        if (avgGripEl) avgGripEl.textContent = `${Number(summary.avgGripStrength ?? 0).toFixed(1)} N`;
        if (avgRangeEl) avgRangeEl.innerHTML = `${Number(summary.avgRangeOfMotion ?? 0).toFixed(1)}&deg; <span class="trend-indicator" id="trendAvgRange" aria-hidden="true"></span>`;

        if (recentActivityBody) {
            const rows = Array.isArray(payload.recentActivity) ? payload.recentActivity : [];
            if (rows.length) {
                recentActivityBody.innerHTML = rows.map(row => {
                    const patientName = escapeHtml(safeText(row.patient_name));
                    const activityLabel = escapeHtml(safeText(row.activity_label, `Assessment: ${defaultAssessmentStageName}`));
                    const metricsPrimary = escapeHtml(safeText(row.metrics_primary, "--"));
                    const metricsSecondary = escapeHtml(safeText(row.metrics_secondary, "--"));
                    const badgeLabel = escapeHtml(safeText(row.badge_label, "Assessment"));
                    const badgeVariant = String(row.badge_variant || "assessment").toLowerCase() === "exercise"
                        ? "exercise"
                        : "assessment";
                    const activityTime = escapeHtml(formatActivityTimestamp(row.recorded_at));

                    return `
                        <tr>
                            <td class="activity-summary-cell">
                                <div class="activity-primary-row">
                                    <span class="activity-primary">${patientName} - ${activityLabel}</span>
                                    <span class="activity-type-chip is-${badgeVariant}">${badgeLabel}</span>
                                </div>
                                <div class="activity-secondary">${metricsPrimary} | ${metricsSecondary}</div>
                            </td>
                            <td class="activity-time-cell">${activityTime}</td>
                        </tr>
                    `;
                }).join("");
                toggleEmptyState(recentActivityEmpty, false);
            } else {
                recentActivityBody.innerHTML = "";
                toggleEmptyState(recentActivityEmpty, true);
            }
        }

        if (quickOverviewBody) {
            const rows = Array.isArray(payload.quickOverview) ? payload.quickOverview : [];
            if (rows.length) {
                quickOverviewBody.innerHTML = rows.map(row => {
                    const drop = Number(row.drop_percent || row.drop || 0);
                    const missed = !!row.missed_session;
                    const normalizedStatus = safeText(row.status, "Stable").toLowerCase();
                    let statusClass = "status-stable";

                    if (normalizedStatus.includes("stable") || normalizedStatus.includes("recovered")) {
                        statusClass = "status-stable";
                    } else if (normalizedStatus.includes("at risk") || normalizedStatus.includes("risk") || normalizedStatus.includes("attention")) {
                        statusClass = "status-at-risk";
                    } else if (normalizedStatus.includes("improving") || normalizedStatus.includes("recovering")) {
                        statusClass = "status-recovering";
                    } else if (!Number.isNaN(drop) && drop >= 20) {
                        statusClass = "status-at-risk";
                    } else if (missed) {
                        statusClass = "status-recovering";
                    }
                    return `
                        <tr>
                            <td>${safeText(row.name)}</td>
                            <td><span class="status-traffic ${statusClass}">${safeText(row.status, "Stable")}</span></td>
                            <td>${safeText(row.last_session, "N/A")}</td>
                        </tr>
                    `;
                }).join("");
                toggleEmptyState(quickOverviewEmpty, false);
            } else {
                quickOverviewBody.innerHTML = "";
                toggleEmptyState(quickOverviewEmpty, true);
            }
        }

        renderWeeklyChart(getChartByActivePeriod(payload));
        updateChartTitle();

        const trends = summary.trends || payload.trends || {};
        setTrend("trendTotalPatients", trends.totalPatients ?? summary.deltaTotalPatients);
        setTrend("trendSessionsToday", trends.sessionsToday ?? summary.deltaSessions);
        setTrend("trendAvgGrip", trends.avgGripStrength ?? summary.deltaAvgGrip);
        setTrend("trendAvgRange", trends.avgRangeOfMotion ?? summary.deltaAvgRange);

        applyUnreadBadge(Number(payload.unreadMessages ?? payload.unreadMessagesCount ?? 0));
    }

    async function fetchDashboardData(patientKey = "all", showLoader = false) {
        if (showLoader && chartWrap) chartWrap.classList.add("is-loading");
        const params = new URLSearchParams();
        if (patientKey !== "all") {
            params.set("patient_id", patientKey);
        }
        const queryString = params.toString();
        const url = `api/doctor/get_patient_data.php${queryString ? `?${queryString}` : ""}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Unable to load dashboard data.");
            }

            const payload = await response.json();
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load dashboard data.");
            }

            renderDashboard(payload);
        } catch (error) {
            // Keep existing values on refresh failures.
        } finally {
            if (showLoader && chartWrap) chartWrap.classList.remove("is-loading");
        }
    }

    metricButtons?.forEach(button => {
        button.addEventListener("click", () => {
            metricButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            activeMetric = button.dataset.metric || "grip";
            if (cachedPayload) {
                renderWeeklyChart(getChartByActivePeriod(cachedPayload));
            }
        });
    });

    periodButtons?.forEach(button => {
        button.addEventListener("click", () => {
            periodButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            activePeriod = button.dataset.period || "weekly";
            updateChartTitle();
            if (cachedPayload) {
                renderWeeklyChart(getChartByActivePeriod(cachedPayload));
            }
        });
    });

    showValuesToggle?.addEventListener("change", () => {
        showChartValues = Boolean(showValuesToggle.checked);
        if (cachedPayload) {
            renderWeeklyChart(getChartByActivePeriod(cachedPayload));
        }
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
        if (patientSelectMenu) patientSelectMenu.hidden = true;
        void fetchDashboardData(selectedPatientKey, true);
    });

    void fetchDashboardData("all", true);

    refreshTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
            void fetchDashboardData(selectedPatientKey, false);
        }
    }, 12000);
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
    const patientTablePagination = document.getElementById("patientTablePagination");
    const patientTablePrevBtn = document.getElementById("patientTablePrevBtn");
    const patientTableNextBtn = document.getElementById("patientTableNextBtn");
    const patientTablePageLabel = document.getElementById("patientTablePageLabel");
    const openModalButton = document.getElementById("openAddPatientModal");
    const closeModalButton = document.getElementById("closeAddPatientModal");
    const modal = document.getElementById("addPatientModal");
    const modalBackdrop = document.getElementById("addPatientModalBackdrop");
    const addPatientForm = document.getElementById("addPatientForm");
    const addPatientSteps = Array.from(document.querySelectorAll(".add-patient-step"));
    const addPatientPageDots = Array.from(document.querySelectorAll(".add-patient-page-dot"));
    const addPatientStepLabel = document.getElementById("addPatientStepLabel");
    const addPatientNextButton = document.getElementById("addPatientNextBtn");
    const addPatientBackButton = document.getElementById("addPatientBackBtn");
    const addPatientSaveButton = document.getElementById("addPatientSaveBtn");
    const addPatientAgeInput = addPatientForm?.querySelector('input[name="age"]') || null;
    const addPatientDobInput = addPatientForm?.querySelector('input[name="dateOfBirth"]') || null;
    const addPatientPasswordInput = addPatientForm?.querySelector('#addPatientPassword') || null;
    const addPatientConfirmPasswordInput = addPatientForm?.querySelector('#addPatientConfirmPassword') || null;
    const addPatientPasswordRules = document.getElementById("addPatientPasswordRules");
    const addPatientRuleLength = document.getElementById("addPatientRuleLength");
    const addPatientRuleUpper = document.getElementById("addPatientRuleUpper");
    const addPatientRuleSpecial = document.getElementById("addPatientRuleSpecial");
    const addPatientPasswordToggles = addPatientForm ? Array.from(addPatientForm.querySelectorAll('.registration-password-toggle[data-password-target]')) : [];
    const saveNotesButton = document.getElementById("saveDoctorNotes");
    const notesInput = document.getElementById("doctorNotesInput");
    const notesFeedback = document.getElementById("notesSaveFeedback");
    const notesCounter = document.getElementById("doctorNotesCounter");
    const clinicalDiagnosisInput = document.getElementById("clinicalDiagnosis");
    const clinicalDiagnosisCounter = document.getElementById("clinicalDiagnosisCounter");
    const clinicalTreatmentGoalInput = document.getElementById("clinicalTreatmentGoal");
    const clinicalTreatmentGoalCounter = document.getElementById("clinicalTreatmentGoalCounter");
    const saveClinicalInfoButton = document.getElementById("saveClinicalInfo");
    const patientMedicalCard = document.querySelector(".patient-medical-card");
    const clinicalSaveFeedback = document.getElementById("clinicalSaveFeedback");
    const openPatientInfoModalButton = document.getElementById("openPatientInfoModal");
    const patientInfoModal = document.getElementById("patientInfoModal");
    const patientInfoModalBackdrop = document.getElementById("patientInfoModalBackdrop");
    const closePatientInfoModalButton = document.getElementById("closePatientInfoModal");
    const donePatientInfoBtn = document.getElementById("donePatientInfoBtn");
    const togglePatientInfoEditBtn = document.getElementById("togglePatientInfoEditBtn");
    const patientInfoForm = document.getElementById("patientInfoForm");
    const patientInfoFeedback = document.getElementById("patientInfoFeedback");
    const patientInfoFirstName = document.getElementById("patientInfoFirstName");
    const patientInfoLastName = document.getElementById("patientInfoLastName");
    const patientInfoDob = document.getElementById("patientInfoDob");
    const patientInfoAge = document.getElementById("patientInfoAge");
    const patientInfoGender = document.getElementById("patientInfoGender");
    const patientInfoEmail = document.getElementById("patientInfoEmail");
    const patientInfoBackupContact = document.getElementById("patientInfoBackupContact");
    const patientInfoUsername = document.getElementById("patientInfoUsername");
    const patientInfoPassword = document.getElementById("patientInfoPassword");
    const openInlinePasswordPanelBtn = document.getElementById("openInlinePasswordPanelBtn");
    const patientInlinePasswordPanel = document.getElementById("patientInlinePasswordPanel");
    const patientInlineCurrentPassword = document.getElementById("patientInlineCurrentPassword");
    const patientInlineNewPassword = document.getElementById("patientInlineNewPassword");
    const patientInlineConfirmPassword = document.getElementById("patientInlineConfirmPassword");
    const saveInlinePasswordBtn = document.getElementById("saveInlinePasswordBtn");
    const cancelInlinePasswordBtn = document.getElementById("cancelInlinePasswordBtn");
    const patientInlinePasswordFeedback = document.getElementById("patientInlinePasswordFeedback");
    const patientInlinePasswordToggles = patientInlinePasswordPanel ? Array.from(patientInlinePasswordPanel.querySelectorAll('.patient-password-eye-btn[data-password-target]')) : [];
    const patientInfoStrokeType = document.getElementById("patientInfoStrokeType");
    const patientInfoAffectedHand = document.getElementById("patientInfoAffectedHand");
    const patientInfoModalCard = patientInfoModal?.querySelector(".patient-info-modal-card") || null;
    const patientPasswordModal = document.getElementById("patientPasswordModal");
    const patientPasswordModalBackdrop = document.getElementById("patientPasswordModalBackdrop");
    const closePatientPasswordModalButton = document.getElementById("closePatientPasswordModal");
    const cancelPatientPasswordBtn = document.getElementById("cancelPatientPasswordBtn");
    const patientPasswordForm = document.getElementById("patientPasswordForm");
    const patientCurrentPassword = document.getElementById("patientCurrentPassword");
    const patientNewPassword = document.getElementById("patientNewPassword");
    const patientRepeatPassword = document.getElementById("patientRepeatPassword");
    const patientPasswordFeedback = document.getElementById("patientPasswordFeedback");
    const patientPasswordToggles = patientPasswordForm ? Array.from(patientPasswordForm.querySelectorAll('.patient-password-toggle[data-password-target]')) : [];

    const profileName = document.getElementById("profilePatientName");
    const profileBreadcrumbName = document.getElementById("patientProfileBreadcrumbName");
    const profileAge = document.getElementById("profilePatientAge");
    const profileStrokeType = document.getElementById("profileStrokeType");
    const profileAffectedHand = document.getElementById("profileAffectedHand");
    const profileGrip = document.getElementById("profileGrip");
    const profileFlexion = document.getElementById("profileFlexion");
    const profileRepetitions = document.getElementById("profileRepetitions");
    const patientGripBest = document.getElementById("patientGripBest");
    const patientFlexionBest = document.getElementById("patientFlexionBest");
    const patientGripChartWrap = document.getElementById("patientGripChartWrap");
    const patientFlexionChartWrap = document.getElementById("patientFlexionChartWrap");
    const patientGripChartEmpty = document.getElementById("patientGripChartEmpty");
    const patientFlexionChartEmpty = document.getElementById("patientFlexionChartEmpty");
    const patientGripViewButtons = Array.from(document.querySelectorAll("#patientGripViewToggle [data-period]"));
    const patientFlexionViewButtons = Array.from(document.querySelectorAll("#patientFlexionViewToggle [data-period]"));
    const patientGripShowValues = document.getElementById("patientGripShowValues");
    const patientFlexionShowValues = document.getElementById("patientFlexionShowValues");
    const planRepetitions = document.getElementById("planRepetitions");
    const planSessions = document.getElementById("planSessions");
    const planTemplateName = document.getElementById("planTemplateName");
    const planExerciseList = document.getElementById("planExerciseList");

    let patients = [];
    let activePatientId = "";
    let addPatientStepIndex = 0;
    let gripChartInstance = null;
    let flexionChartInstance = null;
    let activeGripView = "recent";
    let activeFlexionView = "recent";
    let showGripPointValues = Boolean(patientGripShowValues?.checked);
    let showFlexionPointValues = Boolean(patientFlexionShowValues?.checked);
    let hasPlayedProfileChartEntryAnimation = false;
    let profileMetricsTimer = null;
    let patientTablePage = 1;
    let isDoctorNotesEditing = false;
    let isMedicalInfoEditing = false;
    let isPatientInfoModalEditing = false;
    const characterCounterUpdaters = [];
    const STATUS_OPTIONS = ["Recovering", "At Risk", "Recovered"];
    const PATIENT_TABLE_PAGE_SIZE = 10;

    function bindCharacterCounter(inputElement, counterElement, maxLength) {
        if (!inputElement || !counterElement) {
            return null;
        }

        const updateCounter = () => {
            const value = String(inputElement.value || "");
            if (value.length > maxLength) {
                inputElement.value = value.slice(0, maxLength);
            }
            counterElement.textContent = `${inputElement.value.length}/${maxLength}`;
        };

        inputElement.setAttribute("maxlength", String(maxLength));
        inputElement.addEventListener("input", updateCounter);
        updateCounter();
        return updateCounter;
    }

    function refreshCharacterCounters() {
        characterCounterUpdaters.forEach(update => {
            if (typeof update === "function") {
                update();
            }
        });
    }

    characterCounterUpdaters.push(bindCharacterCounter(clinicalDiagnosisInput, clinicalDiagnosisCounter, 50));
    characterCounterUpdaters.push(bindCharacterCounter(clinicalTreatmentGoalInput, clinicalTreatmentGoalCounter, 50));
    characterCounterUpdaters.push(bindCharacterCounter(notesInput, notesCounter, 200));
    refreshCharacterCounters();

    function setDoctorNotesEditing(enabled) {
        isDoctorNotesEditing = Boolean(enabled);

        if (notesInput) {
            notesInput.disabled = !isDoctorNotesEditing;
            if (isDoctorNotesEditing) {
                notesInput.focus();
                const nextLength = notesInput.value.length;
                notesInput.setSelectionRange(nextLength, nextLength);
            }
        }

        if (saveNotesButton) {
            saveNotesButton.textContent = isDoctorNotesEditing ? "Save Notes" : "Edit Notes";
            saveNotesButton.setAttribute("aria-label", isDoctorNotesEditing ? "Save Notes" : "Edit Notes");
        }
    }

    function setPatientInfoModalEditing(enabled) {
        isPatientInfoModalEditing = Boolean(enabled);

        const editableControls = [
            patientInfoFirstName,
            patientInfoLastName,
            patientInfoDob,
            patientInfoAge,
            patientInfoGender,
            patientInfoEmail,
            patientInfoBackupContact,
            patientInfoStrokeType,
            patientInfoAffectedHand
        ];

        editableControls.forEach(control => {
            if (!control) {
                return;
            }

            if (control instanceof HTMLSelectElement) {
                control.disabled = !isPatientInfoModalEditing;
            } else {
                control.readOnly = !isPatientInfoModalEditing;
            }
        });

        patientInfoModalCard?.classList.toggle("is-editing", isPatientInfoModalEditing);

        if (togglePatientInfoEditBtn) {
            togglePatientInfoEditBtn.textContent = isPatientInfoModalEditing ? "Save Changes" : "Edit Profile";
            togglePatientInfoEditBtn.setAttribute("aria-label", isPatientInfoModalEditing ? "Save patient profile changes" : "Edit patient profile");
        }
    }

    function resetInlinePasswordValidation() {
        if (!patientInlineConfirmPassword || !patientInlineCurrentPassword) {
            return;
        }

        patientInlineConfirmPassword.classList.remove("is-match", "is-mismatch");
    }

    function updateInlinePasswordValidation() {
        if (!patientInlineNewPassword || !patientInlineConfirmPassword || !patientInlineCurrentPassword) {
            return;
        }

        const nextPassword = String(patientInlineNewPassword.value || "");
        const confirmPassword = String(patientInlineConfirmPassword.value || "");
        const currentPassword = String(patientInlineCurrentPassword.value || "");
        
        // Validate confirm password against current password (turns green if it matches the current password)
        patientInlineConfirmPassword.classList.remove("is-match", "is-mismatch");
        if (confirmPassword) {
            if (confirmPassword === currentPassword) {
                patientInlineConfirmPassword.classList.add("is-match");
            } else {
                patientInlineConfirmPassword.classList.add("is-mismatch");
            }
        }
        
    }

    function resetInlinePasswordPanel() {
        if (patientInlineCurrentPassword) patientInlineCurrentPassword.value = "";
        if (patientInlineNewPassword) patientInlineNewPassword.value = "";
        if (patientInlineConfirmPassword) patientInlineConfirmPassword.value = "";
        resetInlinePasswordValidation();

        if (patientInlinePasswordFeedback) {
            patientInlinePasswordFeedback.textContent = "";
        }

        patientInlinePasswordToggles.forEach(toggleButton => {
            const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
            const targetInput = targetId ? document.getElementById(targetId) : null;
            if (targetInput instanceof HTMLInputElement) {
                targetInput.type = "password";
            }

            toggleButton.setAttribute("aria-pressed", "false");
            const icon = toggleButton.querySelector("i");
            if (icon) {
                icon.className = "fa-regular fa-eye";
            }
        });
    }

    function setInlinePasswordPanelOpen(open) {
        if (!patientInlinePasswordPanel) {
            return;
        }

        const isOpen = Boolean(open);
        patientInlinePasswordPanel.hidden = !isOpen;
        openInlinePasswordPanelBtn?.setAttribute("aria-expanded", isOpen ? "true" : "false");

        if (!isOpen) {
            resetInlinePasswordPanel();
            return;
        }

        patientInlineCurrentPassword?.focus();
    }

    function setMedicalInfoEditing(enabled) {
        isMedicalInfoEditing = Boolean(enabled);

        if (clinicalDiagnosisInput) {
            clinicalDiagnosisInput.readOnly = !isMedicalInfoEditing;
        }
        if (clinicalTreatmentGoalInput) {
            clinicalTreatmentGoalInput.readOnly = !isMedicalInfoEditing;
        }

        patientMedicalCard?.classList.toggle("is-editing", isMedicalInfoEditing);

        if (saveClinicalInfoButton) {
            saveClinicalInfoButton.textContent = isMedicalInfoEditing ? "Save" : "Edit";
            saveClinicalInfoButton.setAttribute("aria-label", isMedicalInfoEditing ? "Save medical information" : "Edit medical information");
        }

        if (isMedicalInfoEditing) {
            clinicalDiagnosisInput?.focus();
            const end = clinicalDiagnosisInput?.value.length || 0;
            clinicalDiagnosisInput?.setSelectionRange(end, end);
        }
    }

    function formatGrip(value) {
        return `${Number(value || 0).toFixed(1)} N`;
    }

    function formatFlexion(value) {
        return `${Number(value || 0).toFixed(1)} deg`;
    }

    function setPatientChartControlsActive(buttons, activePeriod) {
        buttons.forEach(button => {
            const period = String(button.getAttribute("data-period") || "");
            const isActive = period === activePeriod;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-selected", String(isActive));
        });
    }

    function getPatientProgressSeries(patient, metricKey, period) {
        const fallback = {
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            values: [0, 0, 0, 0, 0, 0, 0]
        };

        const progressCharts = patient?.progressCharts || {};
        const periodData = progressCharts[period] || progressCharts.daily || {};
        const labels = Array.isArray(periodData.labels) && periodData.labels.length
            ? periodData.labels
            : fallback.labels;
        const rawValues = metricKey === "grip" ? periodData.grip : periodData.flexion;
        const values = Array.isArray(rawValues) && rawValues.length
            ? rawValues.map(value => Number(value || 0))
            : fallback.values;

        return { labels, values };
    }

    function setPatientChartEmptyState(chartWrap, emptyEl, values) {
        const hasData = Array.isArray(values) && values.some(value => Number(value) > 0);
        chartWrap?.classList.toggle("is-empty", !hasData);
        if (emptyEl) {
            emptyEl.hidden = hasData;
        }
    }

    function exerciseTypeLabel(type) {
        if (type === "full_extension") {
            return "Full Extension";
        }
        if (type === "full_close") {
            return "Full Close";
        }
        return "Open-Close Exercise";
    }

    function exerciseTypeIcon(type) {
        if (type === "full_extension") {
            return "fa-regular fa-hand";
        }
        if (type === "full_close") {
            return "fa-solid fa-hand-fist";
        }
        return "fa-regular fa-hand";
    }

    function setPlanField(element, value) {
        if (!element) {
            return;
        }

        const text = String(value ?? "0");
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value = text;
            return;
        }

        element.textContent = text;
    }

    function formatPlanSessionsDisplay(therapyPlan) {
        const exercises = Array.isArray(therapyPlan?.exercises) ? therapyPlan.exercises : [];
        const totalSessions = exercises.reduce((sum, item) => sum + Math.max(0, Number(item?.sessions || 0)), 0);
        if (totalSessions > 0) {
            return String(totalSessions);
        }
        return String(Math.max(0, Number(therapyPlan?.sessionsPerDay || 0)));
    }

    function renderPlanExercises(therapyPlan) {
        if (!planExerciseList) {
            return;
        }

        const exercises = Array.isArray(therapyPlan?.exercises) ? therapyPlan.exercises : [];
        if (!exercises.length) {
            planExerciseList.innerHTML = `
                <li class="therapy-plan-breakdown-item is-empty">
                    <span class="therapy-plan-breakdown-left">No exercise details available.</span>
                </li>
            `;
            return;
        }

        planExerciseList.innerHTML = exercises
            .map(item => {
                const reps = Math.max(0, Number(item?.reps || 0));
                const sessions = Math.max(0, Number(item?.sessions || 0));
                const exerciseType = String(item?.type || "open_close");
                const iconClass = exerciseTypeIcon(exerciseType);
                return `
                    <li class="therapy-plan-breakdown-item">
                        <span class="therapy-plan-breakdown-left">
                            <i class="${iconClass}" aria-hidden="true"></i>
                            <span>${exerciseTypeLabel(exerciseType)}</span>
                        </span>
                        <span class="therapy-plan-breakdown-right">${reps} reps | ${sessions} ${sessions === 1 ? "session" : "sessions"}</span>
                    </li>
                `;
            })
            .join("");
    }

    // Load patients from the API.
    fetch('api/patients/list.php', { cache: 'no-store' })
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
                lastSession: row.last_session || '',
                status: normalizePatientStatus(row.status || 'Recovering'),
                isActiveToday: false,
                metrics: { grip: '0 N', flexion: '0 deg', repetitionsToday: '0' },
                therapyPlan: { templateName: 'Default', duration: 0, repetitions: 0, sessionsPerDay: 0, exercises: [] },
                notes: '',
                chart: { grip: [0, 0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0, 0] },
                best: { grip: 0, flexion: 0 },
                progressCharts: {
                    recent: { labels: ["S1"], grip: [0], flexion: [0] },
                    daily: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], grip: [0, 0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0, 0] },
                    monthly: { labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], grip: [0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0] }
                }
            }));
            activePatientId = patients[0]?.id || '';
            patientTablePage = 1;
            renderPatientTable();
        })
        .catch(() => {
            patients = [];
            activePatientId = "";
            patientTablePage = 1;
            renderPatientTable();
        });

    function normalizePatientStatus(status) {
        const normalized = String(status || "").trim().toLowerCase();
        if (normalized === "at risk" || normalized === "needs attention") {
            return "At Risk";
        }
        if (normalized === "recovered" || normalized === "improving") {
            return "Recovered";
        }
        if (normalized === "stable" || normalized === "recovering") {
            return "Recovering";
        }
        return "Recovering";
    }

    function getStatusPill(status) {
        const normalized = normalizePatientStatus(status);
        if (normalized === "At Risk") {
            return "status-at-risk";
        }
        if (normalized === "Recovered") {
            return "status-recovered";
        }
        return "status-stable";
    }

    function formatLastSession(lastSession) {
        const text = String(lastSession || "").trim();
        if (!text || text.toLowerCase() === "n/a") {
            return '<span class="last-session-empty">No data</span>';
        }
        return text;
    }

    function closeAllStatusMenus() {
        if (!tableBody) {
            return;
        }

        tableBody.querySelectorAll(".status-menu").forEach(menu => {
            menu.hidden = true;
        });

        tableBody.querySelectorAll(".status-chip-trigger").forEach(trigger => {
            trigger.setAttribute("aria-expanded", "false");
        });
    }

    function renderStatusMenu(patientId, currentStatus) {
        return `
            <div class="status-chip-wrap">
                <button type="button" class="status-chip-trigger status-pill ${getStatusPill(currentStatus)}" data-status-patient-id="${patientId}" aria-haspopup="menu" aria-expanded="false">
                    <span>${currentStatus}</span>
                    <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                </button>
                <div class="status-menu" role="menu" hidden>
                    ${STATUS_OPTIONS.map(status => `
                        <button type="button" class="status-menu-option ${status === currentStatus ? "is-active" : ""}" data-status-value="${status}" data-status-patient-id="${patientId}" role="menuitem">
                            ${status}
                        </button>
                    `).join("")}
                </div>
            </div>
        `;
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
                matchesFilter = normalizePatientStatus(patient.status) === selectedStatus;
            }

            return matchesSearch && matchesFilter;
        });
    }

    function renderPatientTable() {
        if (!tableBody) {
            return;
        }

        const filteredPatients = getFilteredPatients();
        const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PATIENT_TABLE_PAGE_SIZE));
        patientTablePage = Math.min(totalPages, Math.max(1, patientTablePage));
        const startIndex = (patientTablePage - 1) * PATIENT_TABLE_PAGE_SIZE;
        const pagePatients = filteredPatients.slice(startIndex, startIndex + PATIENT_TABLE_PAGE_SIZE);

        tableBody.innerHTML = "";
        if (!filteredPatients.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">No patients match your search/filter.</td>
                </tr>
            `;
            if (patientTablePagination && patientTablePrevBtn && patientTableNextBtn && patientTablePageLabel) {
                patientTablePagination.hidden = true;
                patientTablePrevBtn.disabled = true;
                patientTableNextBtn.disabled = true;
                patientTablePageLabel.textContent = "Page 1 of 1";
            }
            return;
        }

        pagePatients.forEach(patient => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${patient.name}</td>
                <td>${patient.age}</td>
                <td>${patient.strokeSide}</td>
                <td>${formatLastSession(patient.lastSession)}</td>
                <td class="patient-status-cell">${renderStatusMenu(patient.id, normalizePatientStatus(patient.status))}</td>
                <td><button type="button" class="table-view-btn" data-patient-id="${patient.id}">View</button></td>
            `;
            tableBody.appendChild(row);
        });

        if (patientTablePagination && patientTablePrevBtn && patientTableNextBtn && patientTablePageLabel) {
            const hasPagination = filteredPatients.length > PATIENT_TABLE_PAGE_SIZE;
            patientTablePagination.hidden = !hasPagination;
            patientTablePrevBtn.disabled = patientTablePage <= 1;
            patientTableNextBtn.disabled = patientTablePage >= totalPages;
            patientTablePageLabel.textContent = `Page ${patientTablePage} of ${totalPages}`;
        }
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

        const gripSeries = getPatientProgressSeries(patient, "grip", activeGripView);
        const flexionSeries = getPatientProgressSeries(patient, "flexion", activeFlexionView);
        const bestGripValue = Number(patient?.best?.grip || 0);
        const bestFlexionValue = Number(patient?.best?.flexion || 0);

        if (patientGripBest) {
            patientGripBest.textContent = bestGripValue > 0 ? `Best: ${bestGripValue.toFixed(1)} N` : "Best: -- N";
        }
        if (patientFlexionBest) {
            patientFlexionBest.textContent = bestFlexionValue > 0 ? `Best: ${bestFlexionValue.toFixed(1)}\u00b0` : "Best: --\u00b0";
        }

        setPatientChartControlsActive(patientGripViewButtons, activeGripView);
        setPatientChartControlsActive(patientFlexionViewButtons, activeFlexionView);
        setPatientChartEmptyState(patientGripChartWrap, patientGripChartEmpty, gripSeries.values);
        setPatientChartEmptyState(patientFlexionChartWrap, patientFlexionChartEmpty, flexionSeries.values);

        destroyProfileCharts();

        const shouldAnimateCharts = !hasPlayedProfileChartEntryAnimation;
        const entryAnimation = shouldAnimateCharts
            ? {
                duration: 1000,
                easing: "easeOutCubic"
            }
            : false;
        const upwardAnimations = shouldAnimateCharts
            ? {
                y: {
                    from: 0
                }
            }
            : {};

        const axisColor = document.body.classList.contains("dark-mode") ? "#88a8b4" : "#5e7f8d";
        const gridColor = document.body.classList.contains("dark-mode") ? "rgba(136,168,180,0.2)" : "rgba(94,127,141,0.15)";
        const gripContext = gripCanvas.getContext("2d");
        const flexionContext = flexionCanvas.getContext("2d");
        const gripGradient = gripContext
            ? gripContext.createLinearGradient(0, 0, 0, gripCanvas.height || 320)
            : null;
        if (gripGradient) {
            gripGradient.addColorStop(0, "rgba(13,95,115,0.26)");
            gripGradient.addColorStop(1, "rgba(13,95,115,0.02)");
        }

        const flexionGradient = flexionContext
            ? flexionContext.createLinearGradient(0, 0, 0, flexionCanvas.height || 320)
            : null;
        if (flexionGradient) {
            flexionGradient.addColorStop(0, "rgba(47,155,114,0.88)");
            flexionGradient.addColorStop(1, "rgba(20,121,91,0.48)");
        }

        function buildValueLabelPlugin(values, suffix, enabled) {
            return {
                id: `profileChartValueLabel-${suffix}`,
                afterDatasetsDraw(chartInstance) {
                    if (!enabled) {
                        return;
                    }

                    const ctx = chartInstance.ctx;
                    const points = chartInstance.getDatasetMeta(0)?.data || [];
                    if (!points.length) {
                        return;
                    }

                    ctx.save();
                    ctx.fillStyle = document.body.classList.contains("dark-mode") ? "#d9ebf3" : "#36505e";
                    ctx.font = "700 12px Poppins, Segoe UI, sans-serif";
                    ctx.textAlign = "center";

                    points.forEach((point, index) => {
                        const raw = Number(values[index] || 0);
                        if (!Number.isFinite(raw) || raw <= 0) {
                            return;
                        }

                        const formatted = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
                        ctx.fillText(formatted, point.x, point.y - 10);
                    });

                    ctx.restore();
                }
            };
        }

        gripChartInstance = new Chart(gripCanvas, {
            type: "line",
            data: {
                labels: gripSeries.labels,
                datasets: [
                    {
                        label: "Force (N)",
                        data: gripSeries.values,
                        borderColor: "#0d5f73",
                        borderWidth: 3,
                        backgroundColor: gripGradient || "rgba(13,95,115,0.14)",
                        fill: true,
                        tension: 0.42,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointBorderColor: "#0d5f73"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: entryAnimation,
                animations: upwardAnimations,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: axisColor }
                    },
                    tooltip: {
                        displayColors: false,
                        backgroundColor: "rgba(15, 60, 73, 0.96)",
                        titleColor: "#ffffff",
                        bodyColor: "#e8f5fa",
                        titleFont: { weight: "700" },
                        bodyFont: { weight: "600" }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: axisColor, font: { weight: "600" } },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: axisColor, font: { weight: "600" } },
                        grid: { color: gridColor, drawBorder: false }
                    }
                }
            },
            plugins: [buildValueLabelPlugin(gripSeries.values, "grip", showGripPointValues)]
        });

        flexionChartInstance = new Chart(flexionCanvas, {
            type: "line",
            data: {
                labels: flexionSeries.labels,
                datasets: [
                    {
                        label: "Finger Movement (\u00b0)",
                        data: flexionSeries.values,
                        backgroundColor: flexionGradient || "rgba(47,155,114,0.75)",
                        borderColor: "rgba(26, 121, 93, 0.95)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointBorderColor: "rgba(26, 121, 93, 0.95)"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: entryAnimation,
                animations: upwardAnimations,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: axisColor }
                    },
                    tooltip: {
                        displayColors: false,
                        backgroundColor: "rgba(19, 74, 58, 0.96)",
                        titleColor: "#ffffff",
                        bodyColor: "#e8f5fa",
                        titleFont: { weight: "700" },
                        bodyFont: { weight: "600" }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: axisColor, font: { weight: "600" } },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: axisColor, font: { weight: "600" } },
                        grid: { color: gridColor, drawBorder: false }
                    }
                }
            },
            plugins: [buildValueLabelPlugin(flexionSeries.values, "flexion", showFlexionPointValues)]
        });

        hasPlayedProfileChartEntryAnimation = true;
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
        setPlanField(planRepetitions, patient.therapyPlan.repetitions);
        setPlanField(planSessions, formatPlanSessionsDisplay(patient.therapyPlan));
        setPlanField(planTemplateName, patient.therapyPlan.templateName || "Default");
        renderPlanExercises(patient.therapyPlan);
        if (notesInput) {
            notesInput.value = patient.notes || "";
        }
        refreshCharacterCounters();
        setDoctorNotesEditing(false);
        if (notesFeedback) {
            notesFeedback.textContent = "";
        }

        if (clinicalSaveFeedback) {
            clinicalSaveFeedback.textContent = "";
        }
        setMedicalInfoEditing(false);
        void loadClinicalData(patient.dbId || patient.id);
        void loadProfileMetrics(patient.dbId || patient.id, true);

        renderProfileCharts(patient);
    }

    async function loadProfileMetrics(patientDbId, updateCharts = false) {
        if (!patientDbId) {
            return;
        }

        try {
            const response = await fetch(`api/patients/profile_metrics.php?patientId=${patientDbId}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || "Unable to load sensor summary.");
            }

            const patient = patients.find(entry => String(entry.dbId || entry.id) === String(patientDbId));
            if (!patient) {
                return;
            }

            const summary = payload.summary || {};
            patient.metrics.grip = formatGrip(summary.avgGripStrength);
            patient.metrics.flexion = formatFlexion(summary.avgFlexionAngle);
            patient.metrics.repetitionsToday = String(Number(summary.repetitionsToday || 0));

            const plan = payload.plan || {};
            patient.therapyPlan.templateName = String(plan.template_name || "Default");
            patient.therapyPlan.duration = Number.isFinite(Number(plan.duration_min)) ? Number(plan.duration_min) : 0;
            patient.therapyPlan.repetitions = Number.isFinite(Number(plan.target_repetitions)) ? Number(plan.target_repetitions) : 0;
            patient.therapyPlan.sessionsPerDay = Number.isFinite(Number(plan.sessions_per_day)) ? Number(plan.sessions_per_day) : 0;
            patient.therapyPlan.exercises = Array.isArray(plan.exercises) ? plan.exercises : [];

            const weekly = payload.weeklyChart || {};
            const gripSeries = Array.isArray(weekly.grip) ? weekly.grip : patient.chart.grip;
            const flexionSeries = Array.isArray(weekly.flexion) ? weekly.flexion : patient.chart.flexion;
            patient.chart = {
                grip: gripSeries,
                flexion: flexionSeries
            };
            patient.best = {
                grip: Number(payload?.best?.grip || 0),
                flexion: Number(payload?.best?.flexion || 0)
            };
            if (payload?.progressCharts && typeof payload.progressCharts === "object") {
                const progressCharts = payload.progressCharts;
                patient.progressCharts = {
                    recent: {
                        labels: Array.isArray(progressCharts?.recent?.labels) ? progressCharts.recent.labels : (patient.progressCharts?.recent?.labels || ["S1"]),
                        grip: Array.isArray(progressCharts?.recent?.grip) ? progressCharts.recent.grip : (patient.progressCharts?.recent?.grip || [0]),
                        flexion: Array.isArray(progressCharts?.recent?.flexion) ? progressCharts.recent.flexion : (patient.progressCharts?.recent?.flexion || [0])
                    },
                    daily: {
                        labels: Array.isArray(progressCharts?.daily?.labels) ? progressCharts.daily.labels : (patient.progressCharts?.daily?.labels || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
                        grip: Array.isArray(progressCharts?.daily?.grip) ? progressCharts.daily.grip : (patient.progressCharts?.daily?.grip || [0, 0, 0, 0, 0, 0, 0]),
                        flexion: Array.isArray(progressCharts?.daily?.flexion) ? progressCharts.daily.flexion : (patient.progressCharts?.daily?.flexion || [0, 0, 0, 0, 0, 0, 0])
                    },
                    monthly: {
                        labels: Array.isArray(progressCharts?.monthly?.labels) ? progressCharts.monthly.labels : (patient.progressCharts?.monthly?.labels || ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]),
                        grip: Array.isArray(progressCharts?.monthly?.grip) ? progressCharts.monthly.grip : (patient.progressCharts?.monthly?.grip || [0, 0, 0, 0, 0, 0]),
                        flexion: Array.isArray(progressCharts?.monthly?.flexion) ? progressCharts.monthly.flexion : (patient.progressCharts?.monthly?.flexion || [0, 0, 0, 0, 0, 0])
                    }
                };
            }

            if (patient.id === activePatientId) {
                if (profileGrip) profileGrip.textContent = patient.metrics.grip;
                if (profileFlexion) profileFlexion.textContent = patient.metrics.flexion;
                if (profileRepetitions) profileRepetitions.textContent = patient.metrics.repetitionsToday;
                setPlanField(planRepetitions, patient.therapyPlan.repetitions);
                setPlanField(planSessions, formatPlanSessionsDisplay(patient.therapyPlan));
                setPlanField(planTemplateName, patient.therapyPlan.templateName || "Default");
                renderPlanExercises(patient.therapyPlan);
                if (updateCharts) {
                    renderProfileCharts(patient);
                }
            }
        } catch (_err) {
            // Silent polling failure by design.
        }
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
            if (notesInput) notesInput.value = clinical.doctor_notes || "";
            refreshCharacterCounters();
            setDoctorNotesEditing(false);
            setMedicalInfoEditing(false);
        } catch (err) {
            if (clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = "Unable to load medical info.";
            }
        }
    }

    function activePatientRecord() {
        return patients.find(entry => entry.id === activePatientId) || null;
    }

    async function loadPatientInfoForModal() {
        const patient = activePatientRecord();
        if (!patient) {
            return;
        }

        const patientDbId = Number(patient.dbId || 0);
        if (!patientDbId) {
            throw new Error("Invalid patient selected.");
        }

        const response = await fetch(`api/patients/profile_manage.php?patientId=${patientDbId}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || !payload?.patient) {
            throw new Error(payload?.error || "Unable to load patient information.");
        }

        const details = payload.patient;
        if (patientInfoFirstName) patientInfoFirstName.value = String(details.firstName || "");
        if (patientInfoLastName) patientInfoLastName.value = String(details.lastName || "");
        if (patientInfoDob) patientInfoDob.value = String(details.dob || "");
        if (patientInfoAge) patientInfoAge.value = String(Number(details.age || 0));
        if (patientInfoGender) patientInfoGender.value = String(details.gender || "");
        if (patientInfoEmail) patientInfoEmail.value = String(details.email || "");
        if (patientInfoBackupContact) patientInfoBackupContact.value = String(details.backupContact || "");
        if (patientInfoUsername) patientInfoUsername.value = String(details.username || "");
        if (patientInfoPassword) patientInfoPassword.value = "••••••••";
        if (patientInfoStrokeType) patientInfoStrokeType.value = String(details.strokeType || "");
        if (patientInfoAffectedHand) patientInfoAffectedHand.value = String(details.affectedHand || "");
    }

    function openPatientInfoModal() {
        if (!patientInfoModal) {
            return;
        }

        if (patientInfoFeedback) {
            patientInfoFeedback.textContent = "";
        }

        loadPatientInfoForModal()
            .then(() => {
                setPatientInfoModalEditing(false);
                setInlinePasswordPanelOpen(false);
                patientInfoModal.hidden = false;
                document.body.style.overflow = "hidden";
            })
            .catch(error => {
                alert(error instanceof Error ? error.message : "Unable to load patient information.");
            });
    }

    function closePatientInfoModal() {
        if (!patientInfoModal) {
            return;
        }

        patientInfoModal.hidden = true;
        if (patientInfoForm) {
            patientInfoForm.reset();
        }
        setPatientInfoModalEditing(false);
        setInlinePasswordPanelOpen(false);
        if (patientInfoFeedback) {
            patientInfoFeedback.textContent = "";
        }
        document.body.style.overflow = "";
    }

    function openPatientPasswordModal() {
        if (!patientPasswordModal) {
            return;
        }

        if (patientPasswordFeedback) {
            patientPasswordFeedback.textContent = "";
        }
        if (patientPasswordForm) {
            patientPasswordForm.reset();
        }
        patientPasswordToggles.forEach(toggleButton => {
            const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
            const targetInput = targetId ? document.getElementById(targetId) : null;
            if (targetInput instanceof HTMLInputElement) {
                targetInput.type = "password";
            }
            toggleButton.setAttribute("aria-pressed", "false");
            const icon = toggleButton.querySelector("i");
            if (icon) {
                icon.className = "fa-regular fa-eye";
            }
        });

        patientPasswordModal.hidden = false;
        document.body.style.overflow = "hidden";
        patientCurrentPassword?.focus();
    }

    function closePatientPasswordModal() {
        if (!patientPasswordModal) {
            return;
        }

        patientPasswordModal.hidden = true;
        if (patientPasswordForm) {
            patientPasswordForm.reset();
        }
        if (patientPasswordFeedback) {
            patientPasswordFeedback.textContent = "";
        }
        if (!patientInfoModal || patientInfoModal.hidden) {
            document.body.style.overflow = "";
        }
    }

    async function savePatientInfoFromModal() {
        const patient = activePatientRecord();
        if (!patient) {
            throw new Error("No active patient selected.");
        }

        const patientDbId = Number(patient.dbId || 0);
        if (!patientDbId) {
            throw new Error("Invalid patient selected.");
        }

        const body = {
            patientId: patientDbId,
            firstName: String(patientInfoFirstName?.value || "").trim(),
            lastName: String(patientInfoLastName?.value || "").trim(),
            dob: String(patientInfoDob?.value || "").trim(),
            age: Number(patientInfoAge?.value || 0),
            gender: String(patientInfoGender?.value || "").trim(),
            email: String(patientInfoEmail?.value || "").trim(),
            backupContact: String(patientInfoBackupContact?.value || "").trim(),
            strokeType: String(patientInfoStrokeType?.value || "").trim(),
            affectedHand: String(patientInfoAffectedHand?.value || "").trim()
        };

        const response = await fetch("api/patients/profile_manage.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to save patient information.");
        }

        const nextName = `${body.firstName} ${body.lastName}`.trim();
        patients = patients.map(entry => {
            if (entry.id !== patient.id) {
                return entry;
            }

            return {
                ...entry,
                name: nextName || entry.name,
                age: body.age,
                strokeType: body.strokeType,
                strokeSide: body.affectedHand,
                affectedHand: body.affectedHand
            };
        });

        setProfilePatient(patient.id);
        renderPatientTable();
    }

    async function savePatientPasswordFromModal() {
        const currentPassword = String(patientCurrentPassword?.value || "");
        const newPassword = String(patientNewPassword?.value || "");
        const confirmNewPassword = String(patientRepeatPassword?.value || "");

        await savePatientPasswordWithValues({ currentPassword, newPassword, confirmNewPassword });

        if (patientInfoPassword) {
            patientInfoPassword.value = "••••••••";
        }
    }

    async function savePatientPasswordWithValues({ currentPassword, newPassword, confirmNewPassword }) {
        const patient = activePatientRecord();
        if (!patient) {
            throw new Error("No active patient selected.");
        }

        const patientDbId = Number(patient.dbId || 0);
        if (!patientDbId) {
            throw new Error("Invalid patient selected.");
        }

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            throw new Error("Please complete all password fields.");
        }

        const response = await fetch("api/patients/profile_manage.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientId: patientDbId,
                currentPassword,
                newPassword,
                confirmNewPassword
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to update password.");
        }
    }

    async function saveClinicalData(patientDbId, { diagnosis, treatmentGoal, doctorNotes }, options = {}) {
        if (!patientDbId) return false;
        const showClinicalFeedback = options.showClinicalFeedback !== false;
        if (showClinicalFeedback && clinicalSaveFeedback) {
            clinicalSaveFeedback.textContent = "Saving medical info...";
        }
        try {
            const response = await fetch("api/patients/clinical.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patientDbId,
                    diagnosis,
                    treatmentGoal,
                    doctorNotes
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || "Unable to save medical info.");
            }
            if (showClinicalFeedback && clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = "Medical info saved.";
            }
            return true;
        } catch (err) {
            if (showClinicalFeedback && clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = err instanceof Error ? err.message : "Unable to save medical info.";
            }
            return false;
        }
    }

    async function persistPatientStatus(patientDbId, status) {
        const response = await fetch("api/patients/update_status.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientId: patientDbId,
                status
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to save patient status.");
        }

        return String(payload.status || status);
    }

    function showProfileView(patientId) {
        setProfilePatient(patientId);
        if (listView) {
            listView.classList.add("is-hidden");
        }
        if (profileView) {
            profileView.classList.remove("is-hidden");
        }

        const patient = patients.find(entry => entry.id === patientId);
        if (patient) {
            if (profileMetricsTimer) {
                window.clearInterval(profileMetricsTimer);
            }
            profileMetricsTimer = window.setInterval(() => {
                if (document.visibilityState === "visible") {
                    void loadProfileMetrics(patient.dbId || patient.id, true);
                }
            }, 5000);
        }
    }

    function showListView() {
        if (profileView) {
            profileView.classList.add("is-hidden");
        }
        if (listView) {
            listView.classList.remove("is-hidden");
        }

        if (profileMetricsTimer) {
            window.clearInterval(profileMetricsTimer);
            profileMetricsTimer = null;
        }
    }

    function rerenderActivePatientCharts() {
        const patient = activePatientRecord();
        if (!patient) {
            return;
        }

        renderProfileCharts(patient);
    }

    function bindPatientChartPeriodControls(buttons, onChange) {
        buttons.forEach(button => {
            button.addEventListener("click", () => {
                const nextPeriod = String(button.getAttribute("data-period") || "").trim().toLowerCase();
                if (!["recent", "daily", "monthly"].includes(nextPeriod)) {
                    return;
                }

                onChange(nextPeriod);
                rerenderActivePatientCharts();
            });
        });
    }

    bindPatientChartPeriodControls(patientGripViewButtons, nextPeriod => {
        activeGripView = nextPeriod;
    });

    bindPatientChartPeriodControls(patientFlexionViewButtons, nextPeriod => {
        activeFlexionView = nextPeriod;
    });

    patientGripShowValues?.addEventListener("change", () => {
        showGripPointValues = Boolean(patientGripShowValues.checked);
        rerenderActivePatientCharts();
    });

    patientFlexionShowValues?.addEventListener("change", () => {
        showFlexionPointValues = Boolean(patientFlexionShowValues.checked);
        rerenderActivePatientCharts();
    });

    function openModal() {
        if (!modal) {
            return;
        }

        modal.hidden = false;
        document.body.style.overflow = "hidden";
        setAddPatientStep(0);
        syncAgeFromDob();
    }

    function closeModal() {
        if (!modal) {
            return;
        }

        modal.hidden = true;
        document.body.style.overflow = "";
        if (addPatientForm) {
            addPatientForm.reset();
            addPatientPasswordToggles.forEach(toggleButton => {
                const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
                if (!targetId) {
                    return;
                }

                const targetInput = addPatientForm.querySelector(`#${targetId}`);
                if (targetInput instanceof HTMLInputElement) {
                    targetInput.type = "password";
                }

                toggleButton.setAttribute("aria-pressed", "false");
                const icon = toggleButton.querySelector("i");
                if (icon) {
                    icon.className = "fa-regular fa-eye";
                }
            });
        }
        if (addPatientAgeInput) {
            addPatientAgeInput.value = "";
        }
        if (addPatientPasswordInput) {
            addPatientPasswordInput.setCustomValidity("");
        }
        addPatientPasswordRules?.classList.add("is-hidden");
        addPatientRuleLength?.classList.remove("is-met");
        addPatientRuleUpper?.classList.remove("is-met");
        addPatientRuleSpecial?.classList.remove("is-met");
        if (addPatientConfirmPasswordInput) {
            addPatientConfirmPasswordInput.classList.remove("is-match", "is-mismatch");
        }
        setAddPatientStep(0);
    }

    function areAddPatientPasswordRulesMet() {
        if (!addPatientPasswordInput) {
            return false;
        }

        const passwordValue = String(addPatientPasswordInput.value || "");
        return passwordValue.length >= 6
            && /[A-Z]/.test(passwordValue)
            && /[^A-Za-z0-9]/.test(passwordValue);
    }

    function updateAddPatientPasswordRulesVisibility(forceShow = false) {
        if (!addPatientPasswordRules) {
            return;
        }

        const rulesMet = areAddPatientPasswordRulesMet();
        const shouldShow = forceShow && !rulesMet;
        addPatientPasswordRules.classList.toggle("is-hidden", !shouldShow);
    }

    function updateAddPatientPasswordRequirementValidation() {
        if (!addPatientPasswordInput) {
            return;
        }

        const passwordValue = String(addPatientPasswordInput.value || "");
        const hasMinLength = passwordValue.length >= 6;
        const hasUppercase = /[A-Z]/.test(passwordValue);
        const hasSpecial = /[^A-Za-z0-9]/.test(passwordValue);
        addPatientRuleLength?.classList.toggle("is-met", hasMinLength);
        addPatientRuleUpper?.classList.toggle("is-met", hasUppercase);
        addPatientRuleSpecial?.classList.toggle("is-met", hasSpecial);

        const missing = [];

        if (!hasMinLength) {
            missing.push("at least 6 characters");
        }
        if (!hasUppercase) {
            missing.push("1 uppercase letter");
        }
        if (!hasSpecial) {
            missing.push("1 special character");
        }

        if (!missing.length) {
            addPatientPasswordInput.setCustomValidity("");
            updateAddPatientPasswordRulesVisibility(false);
            return;
        }

        const message = `Password still needs: ${missing.join(", ")}.`;
        addPatientPasswordInput.setCustomValidity(message);

        if (document.activeElement === addPatientPasswordInput) {
            updateAddPatientPasswordRulesVisibility(true);
        }
    }

    function updateAddPatientConfirmPasswordValidation() {
        if (!addPatientPasswordInput || !addPatientConfirmPasswordInput) {
            return;
        }

        const passwordValue = String(addPatientPasswordInput.value || "");
        const confirmValue = String(addPatientConfirmPasswordInput.value || "");
        addPatientConfirmPasswordInput.classList.remove("is-match", "is-mismatch");

        if (!confirmValue) {
            return;
        }

        if (passwordValue === confirmValue) {
            addPatientConfirmPasswordInput.classList.add("is-match");
            return;
        }

        addPatientConfirmPasswordInput.classList.add("is-mismatch");
    }

    function setAddPatientStep(stepIndex) {
        if (!addPatientSteps.length) {
            return;
        }

        addPatientStepIndex = Math.max(0, Math.min(stepIndex, addPatientSteps.length - 1));
        addPatientSteps.forEach((stepElement, index) => {
            stepElement.hidden = index !== addPatientStepIndex;
        });

        if (addPatientBackButton) {
            const hideBack = addPatientStepIndex === 0;
            addPatientBackButton.classList.toggle("is-hidden-nav", hideBack);
            addPatientBackButton.setAttribute("aria-hidden", String(hideBack));
            addPatientBackButton.disabled = hideBack;
        }
        if (addPatientNextButton) {
            const hideNext = addPatientStepIndex === addPatientSteps.length - 1;
            addPatientNextButton.classList.toggle("is-hidden-nav", hideNext);
            addPatientNextButton.setAttribute("aria-hidden", String(hideNext));
            addPatientNextButton.disabled = hideNext;
        }
        if (addPatientSaveButton) {
            addPatientSaveButton.hidden = addPatientStepIndex !== addPatientSteps.length - 1;
        }

        if (addPatientStepLabel) {
            addPatientStepLabel.textContent = addPatientStepIndex === 0
                ? "Step 1 of 2: Personal details"
                : "Step 2 of 2: Clinical and login details";
        }

        addPatientPageDots.forEach((dot, index) => {
            dot.classList.toggle("is-active", index === addPatientStepIndex);
        });
    }

    function validateAddPatientStep(stepIndex) {
        if (stepIndex === 0) {
            syncAgeFromDob();
        }

        const stepElement = addPatientSteps[stepIndex];
        if (!stepElement) {
            return true;
        }

        const fields = Array.from(stepElement.querySelectorAll("input, select, textarea"));
        for (const field of fields) {
            if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
                continue;
            }
            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
        }
        return true;
    }

    function calculateAgeFromDob(dobValue) {
        const normalizedDob = normalizeDobToIso(dobValue);
        if (!normalizedDob) {
            return null;
        }

        const dob = new Date(`${normalizedDob}T00:00:00`);
        if (Number.isNaN(dob.getTime())) {
            return null;
        }

        const today = new Date();
        if (dob > today) {
            return null;
        }

        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age -= 1;
        }

        if (age < 0 || age > 130) {
            return null;
        }

        return age;
    }

    function syncAgeFromDob() {
        if (!addPatientDobInput || !addPatientAgeInput) {
            return;
        }

        const computedAge = calculateAgeFromDob(String(addPatientDobInput.value || "").trim());
        addPatientAgeInput.value = computedAge === null ? "" : String(computedAge);
    }

    function maskDobInput(rawValue) {
        const digits = String(rawValue || "").replace(/\D/g, "").slice(0, 8);
        const month = digits.slice(0, 2);
        const day = digits.slice(2, 4);
        const year = digits.slice(4, 8);

        let masked = month;
        if (day) {
            masked += ` / ${day}`;
        }
        if (year) {
            masked += ` / ${year}`;
        }
        return masked;
    }

    function normalizeDobToIso(dobValue) {
        const trimmed = String(dobValue || "").trim();
        if (!trimmed) {
            return "";
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }

        const compactSlash = trimmed.replace(/\s+/g, "");
        const slashMatch = compactSlash.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!slashMatch) {
            return "";
        }

        const monthPart = slashMatch[1].padStart(2, "0");
        const dayPart = slashMatch[2].padStart(2, "0");
        const yearPart = slashMatch[3];
        return `${yearPart}-${monthPart}-${dayPart}`;
    }

    async function addPatientFromForm(form) {
        const formData = new FormData(form);
        const firstName   = String(formData.get("firstName") || "").trim();
        const lastName    = String(formData.get("lastName") || "").trim();
        const patientName = `${firstName} ${lastName}`.trim();
        const dateOfBirth = String(formData.get("dateOfBirth") || "").trim();
        const gender      = String(formData.get("gender") || "").trim();
        const strokeType  = String(formData.get("strokeType") || "").trim();
        const affectedHand = String(formData.get("affectedHand") || "").trim();
        const email       = String(formData.get("email") || "").trim();
        const backupContact = String(formData.get("backupContact") || "").trim();
        const username    = String(formData.get("username") || "").trim();
        const password    = String(formData.get("password") || "");
        const confirmPassword = String(formData.get("confirmPassword") || "");

        if (!confirmPassword) {
            alert("Confirm password is required.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Password and confirm password must match.");
            return;
        }

        if (!(password.length >= 6 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password))) {
            alert("Password must be at least 6 characters with 1 uppercase letter, 1 number, and 1 special character.");
            return;
        }

        const normalizedEmail = email.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            alert("Email address is required and must be valid.");
            return;
        }

        const normalizedBackup = backupContact.replace(/\s+/g, "");
        const isBackupEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupContact);
        const isBackupPhone = /^\+?\d{7,15}$/.test(normalizedBackup);
        if (backupContact && !isBackupEmail && !isBackupPhone) {
            alert("Backup contact must be a valid phone number or email address.");
            return;
        }

        const computedAge = calculateAgeFromDob(dateOfBirth);
        if (computedAge === null) {
            alert("Please enter a valid date of birth.");
            return;
        }
        const age = computedAge;
        const isoDateOfBirth = normalizeDobToIso(dateOfBirth);

        try {
            const response = await fetch('api/patients/create.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    name: patientName,
                    age,
                    dateOfBirth: isoDateOfBirth,
                    gender,
                    strokeType,
                    affectedHand,
                    email: normalizedEmail,
                    backupContact: isBackupPhone ? normalizedBackup : backupContact,
                    username,
                    password
                })
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
                    lastSession: "",
                    status: "Recovering",
                    isActiveToday: false,
                    metrics: { grip: "0 N", flexion: "0 deg", repetitionsToday: "0" },
                    therapyPlan: { templateName: "Default", duration: 0, repetitions: 0, sessionsPerDay: 0, exercises: [] },
                    notes: "",
                    chart: { grip: [0, 0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0, 0] },
                    best: { grip: 0, flexion: 0 },
                    progressCharts: {
                        recent: { labels: ["S1"], grip: [0], flexion: [0] },
                        daily: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], grip: [0, 0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0, 0] },
                        monthly: { labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], grip: [0, 0, 0, 0, 0, 0], flexion: [0, 0, 0, 0, 0, 0] }
                    }
                };

                patients = [patient, ...patients];
                activePatientId = patient.id;
                patientTablePage = 1;
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
        const statusOptionButton = event.target instanceof HTMLElement ? event.target.closest(".status-menu-option") : null;
        if (statusOptionButton) {
            const patientId = statusOptionButton.getAttribute("data-status-patient-id");
            const nextStatus = normalizePatientStatus(statusOptionButton.getAttribute("data-status-value") || "Recovering");
            if (patientId) {
                const targetPatient = patients.find(patient => patient.id === patientId);
                if (!targetPatient) {
                    return;
                }

                persistPatientStatus(targetPatient.dbId || targetPatient.id, nextStatus)
                    .then(savedStatus => {
                        patients = patients.map(patient => {
                            if (patient.id !== patientId) {
                                return patient;
                            }
                            return {
                                ...patient,
                                status: normalizePatientStatus(savedStatus)
                            };
                        });
                        renderPatientTable();
                    })
                    .catch(error => {
                        alert(error instanceof Error ? error.message : "Unable to save patient status.");
                    });
            }
            return;
        }

        const statusTriggerButton = event.target instanceof HTMLElement ? event.target.closest(".status-chip-trigger") : null;
        if (statusTriggerButton) {
            const container = statusTriggerButton.closest(".status-chip-wrap");
            const targetMenu = container?.querySelector(".status-menu");
            if (!targetMenu) {
                return;
            }

            const shouldOpen = targetMenu.hidden;
            closeAllStatusMenus();
            targetMenu.hidden = !shouldOpen;
            statusTriggerButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
            return;
        }

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

    searchInput?.addEventListener("input", () => {
        patientTablePage = 1;
        renderPatientTable();
    });
    statusFilter?.addEventListener("change", () => {
        patientTablePage = 1;
        renderPatientTable();
    });

    patientTablePrevBtn?.addEventListener("click", () => {
        patientTablePage = Math.max(1, patientTablePage - 1);
        renderPatientTable();
    });

    patientTableNextBtn?.addEventListener("click", () => {
        const filteredCount = getFilteredPatients().length;
        const totalPages = Math.max(1, Math.ceil(filteredCount / PATIENT_TABLE_PAGE_SIZE));
        patientTablePage = Math.min(totalPages, patientTablePage + 1);
        renderPatientTable();
    });

    openModalButton?.addEventListener("click", openModal);
    closeModalButton?.addEventListener("click", closeModal);
    modalBackdrop?.addEventListener("click", closeModal);
    openPatientInfoModalButton?.addEventListener("click", openPatientInfoModal);
    closePatientInfoModalButton?.addEventListener("click", closePatientInfoModal);
    donePatientInfoBtn?.addEventListener("click", closePatientInfoModal);
    togglePatientInfoEditBtn?.addEventListener("click", async () => {
        if (!isPatientInfoModalEditing) {
            if (patientInfoFeedback) {
                patientInfoFeedback.textContent = "";
            }
            setPatientInfoModalEditing(true);
            patientInfoFirstName?.focus();
            return;
        }

        togglePatientInfoEditBtn.disabled = true;
        try {
            await savePatientInfoFromModal();
            setPatientInfoModalEditing(false);
            if (patientInfoFeedback) {
                patientInfoFeedback.textContent = "Changes saved.";
            }
        } catch (error) {
            if (patientInfoFeedback) {
                patientInfoFeedback.textContent = error instanceof Error ? error.message : "Unable to save patient information.";
            }
        } finally {
            togglePatientInfoEditBtn.disabled = false;
        }
    });
    openInlinePasswordPanelBtn?.addEventListener("click", () => {
        const isOpen = Boolean(patientInlinePasswordPanel && !patientInlinePasswordPanel.hidden);
        setInlinePasswordPanelOpen(!isOpen);
    });
    cancelInlinePasswordBtn?.addEventListener("click", () => {
        setInlinePasswordPanelOpen(false);
    });
    saveInlinePasswordBtn?.addEventListener("click", async () => {
        if (patientInlinePasswordFeedback) {
            patientInlinePasswordFeedback.textContent = "Updating password...";
        }

        const currentPassword = String(patientInlineCurrentPassword?.value || "");
        const newPassword = String(patientInlineNewPassword?.value || "");
        const confirmNewPassword = String(patientInlineConfirmPassword?.value || "");

        if (confirmNewPassword !== newPassword) {
            updateInlinePasswordValidation();
            if (patientInlinePasswordFeedback) {
                patientInlinePasswordFeedback.textContent = "New password and confirm password must match.";
            }
            return;
        }

        saveInlinePasswordBtn.disabled = true;
        try {
            await savePatientPasswordWithValues({ currentPassword, newPassword, confirmNewPassword });
            if (patientInfoPassword) {
                patientInfoPassword.value = "••••••••";
            }
            if (patientInlinePasswordFeedback) {
                patientInlinePasswordFeedback.textContent = "Password updated.";
            }
            setInlinePasswordPanelOpen(false);
        } catch (error) {
            if (patientInlinePasswordFeedback) {
                patientInlinePasswordFeedback.textContent = error instanceof Error ? error.message : "Unable to update password.";
            }
        } finally {
            saveInlinePasswordBtn.disabled = false;
        }
    });
    patientInlinePasswordToggles.forEach(toggleButton => {
        toggleButton.addEventListener("click", () => {
            const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
            if (!targetId) {
                return;
            }

            const targetInput = document.getElementById(targetId);
            if (!(targetInput instanceof HTMLInputElement)) {
                return;
            }

            const show = targetInput.type === "password";
            targetInput.type = show ? "text" : "password";
            toggleButton.setAttribute("aria-pressed", show ? "true" : "false");

            const icon = toggleButton.querySelector("i");
            if (icon) {
                icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            }
        });
    });
    patientInlineCurrentPassword?.addEventListener("input", updateInlinePasswordValidation);
    patientInlineNewPassword?.addEventListener("input", updateInlinePasswordValidation);
    patientInlineConfirmPassword?.addEventListener("input", updateInlinePasswordValidation);
    patientInfoModalBackdrop?.addEventListener("click", closePatientInfoModal);
    closePatientPasswordModalButton?.addEventListener("click", closePatientPasswordModal);
    cancelPatientPasswordBtn?.addEventListener("click", closePatientPasswordModal);
    patientPasswordModalBackdrop?.addEventListener("click", closePatientPasswordModal);

    patientPasswordForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (patientPasswordFeedback) {
            patientPasswordFeedback.textContent = "Saving password...";
        }

        try {
            await savePatientPasswordFromModal();
            closePatientPasswordModal();
        } catch (error) {
            if (patientPasswordFeedback) {
                patientPasswordFeedback.textContent = error instanceof Error ? error.message : "Unable to update password.";
            }
        }
    });

    patientPasswordToggles.forEach(toggleButton => {
        toggleButton.addEventListener("click", () => {
            const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
            if (!targetId) {
                return;
            }

            const targetInput = document.getElementById(targetId);
            if (!(targetInput instanceof HTMLInputElement)) {
                return;
            }

            const show = targetInput.type === "password";
            targetInput.type = show ? "text" : "password";
            toggleButton.setAttribute("aria-pressed", show ? "true" : "false");

            const icon = toggleButton.querySelector("i");
            if (icon) {
                icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            }
        });
    });

    patientInfoForm?.addEventListener("submit", event => {
        event.preventDefault();
    });

    addPatientForm?.addEventListener("submit", event => {
        event.preventDefault();
        if (!(event.currentTarget instanceof HTMLFormElement)) {
            return;
        }

        if (addPatientStepIndex !== addPatientSteps.length - 1) {
            if (validateAddPatientStep(addPatientStepIndex)) {
                setAddPatientStep(addPatientStepIndex + 1);
            }
            return;
        }

        if (!event.currentTarget.checkValidity()) {
            event.currentTarget.reportValidity();
            return;
        }

        void addPatientFromForm(event.currentTarget);
    });

    addPatientPasswordToggles.forEach(toggleButton => {
        toggleButton.addEventListener("click", () => {
            const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
            if (!targetId || !addPatientForm) {
                return;
            }

            const targetInput = addPatientForm.querySelector(`#${targetId}`);
            if (!(targetInput instanceof HTMLInputElement)) {
                return;
            }

            const show = targetInput.type === "password";
            targetInput.type = show ? "text" : "password";
            toggleButton.setAttribute("aria-pressed", show ? "true" : "false");

            const icon = toggleButton.querySelector("i");
            if (icon) {
                icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            }
        });
    });

    addPatientDobInput?.addEventListener("input", () => {
        if (!addPatientDobInput) {
            return;
        }
        const nextValue = maskDobInput(addPatientDobInput.value);
        if (nextValue !== addPatientDobInput.value) {
            addPatientDobInput.value = nextValue;
        }
        syncAgeFromDob();
    });
    addPatientDobInput?.addEventListener("change", syncAgeFromDob);
    addPatientDobInput?.addEventListener("blur", syncAgeFromDob);
    addPatientPasswordInput?.addEventListener("focus", () => {
        updateAddPatientPasswordRequirementValidation();
        updateAddPatientPasswordRulesVisibility(true);
    });
    addPatientPasswordInput?.addEventListener("click", () => {
        updateAddPatientPasswordRequirementValidation();
        updateAddPatientPasswordRulesVisibility(true);
    });
    addPatientPasswordInput?.addEventListener("blur", () => {
        updateAddPatientPasswordRulesVisibility(false);
    });
    addPatientPasswordInput?.addEventListener("input", updateAddPatientPasswordRequirementValidation);
    addPatientPasswordInput?.addEventListener("input", updateAddPatientConfirmPasswordValidation);
    addPatientConfirmPasswordInput?.addEventListener("input", updateAddPatientConfirmPasswordValidation);

    addPatientNextButton?.addEventListener("click", () => {
        if (!validateAddPatientStep(addPatientStepIndex)) {
            return;
        }
        setAddPatientStep(addPatientStepIndex + 1);
    });

    addPatientBackButton?.addEventListener("click", () => {
        setAddPatientStep(addPatientStepIndex - 1);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal && !modal.hidden) {
            closeModal();
        }
        if (event.key === "Escape" && patientPasswordModal && !patientPasswordModal.hidden) {
            closePatientPasswordModal();
        }
        if (event.key === "Escape" && patientInfoModal && !patientInfoModal.hidden) {
            closePatientInfoModal();
        }
        if (event.key === "Escape") {
            closeAllStatusMenus();
        }
    });

    document.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Node) || !tableBody) {
            return;
        }
        const clickedInsideTable = tableBody.contains(target);
        const clickedStatusControl = target instanceof HTMLElement && Boolean(target.closest(".status-chip-wrap"));
        if (clickedInsideTable && clickedStatusControl) {
            return;
        }
        closeAllStatusMenus();
    });

    saveNotesButton?.addEventListener("click", async () => {
        if (!notesInput) {
            return;
        }

        if (!isDoctorNotesEditing) {
            if (notesFeedback) {
                notesFeedback.textContent = "";
            }
            setDoctorNotesEditing(true);
            return;
        }

        const patient = patients.find(entry => entry.id === activePatientId);
        if (!patient) {
            if (notesFeedback) {
                notesFeedback.textContent = "Select a patient first before saving notes.";
            }
            return;
        }

        if (notesInput.value.length > 200) {
            if (notesFeedback) {
                notesFeedback.textContent = "Doctor notes cannot exceed 200 characters.";
            }
            return;
        }

        saveNotesButton.disabled = true;
        patient.notes = notesInput.value.trim();
        const diagnosis = clinicalDiagnosisInput?.value.trim() || "";
        const treatmentGoal = clinicalTreatmentGoalInput?.value.trim() || "";
        const saved = await saveClinicalData(patient.dbId || patient.id, {
            diagnosis,
            treatmentGoal,
            doctorNotes: patient.notes
        }, { showClinicalFeedback: false });

        saveNotesButton.disabled = false;
        if (notesFeedback) {
            notesFeedback.textContent = saved ? "Notes saved." : "Unable to save notes.";
        }
        if (saved) {
            setDoctorNotesEditing(false);
        }
    });

    saveClinicalInfoButton?.addEventListener("click", async () => {
        if (!isMedicalInfoEditing) {
            if (clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = "";
            }
            setMedicalInfoEditing(true);
            return;
        }

        const patient = patients.find(entry => entry.id === activePatientId);
        if (!patient) {
            return;
        }

        const diagnosis = clinicalDiagnosisInput?.value.trim() || "";
        const treatmentGoal = clinicalTreatmentGoalInput?.value.trim() || "";
        const doctorNotes = notesInput?.value.trim() || "";

        if (diagnosis.length > 50 || treatmentGoal.length > 50 || doctorNotes.length > 200) {
            if (clinicalSaveFeedback) {
                clinicalSaveFeedback.textContent = "Please keep Diagnosis and Treatment Goal within 50 characters, and Notes within 200 characters.";
            }
            return;
        }

        saveClinicalInfoButton.disabled = true;
        const saved = await saveClinicalData(patient.dbId || patient.id, { diagnosis, treatmentGoal, doctorNotes });
        saveClinicalInfoButton.disabled = false;
        if (saved) {
            setMedicalInfoEditing(false);
        }
    });

    renderPatientTable();
    setDoctorNotesEditing(false);
    setMedicalInfoEditing(false);
}

function initializeTherapyPlansPage() {
    const pageRoot = document.getElementById("therapyPlansRoot");
    if (!pageRoot) {
        return;
    }

    const assignmentsBody = document.getElementById("therapyAssignmentsBody");
    const openAssignPlanModalBtn = document.getElementById("openAssignPlanModalBtn");
    const assignPatientSelect = document.getElementById("assignPatientSelect");
    const assignTemplateSelect = document.getElementById("assignTemplateSelect");
    const applyTemplateBtn = document.getElementById("applyTemplateBtn");
    const assignFeedback = document.getElementById("assignTemplateFeedback");
    const assignPopup = document.getElementById("therapyAssignPopup");
    const assignBackdrop = document.getElementById("therapyAssignBackdrop");
    const closeAssignPlanModalBtn = document.getElementById("closeAssignPlanModal");
    const assignmentsPagination = document.getElementById("therapyAssignmentsPagination");
    const assignmentsPrevBtn = document.getElementById("therapyAssignmentsPrevBtn");
    const assignmentsNextBtn = document.getElementById("therapyAssignmentsNextBtn");
    const assignmentsPageLabel = document.getElementById("therapyAssignmentsPageLabel");
    const editPopup = document.getElementById("therapyEditPopup");
    const editBackdrop = document.getElementById("therapyEditBackdrop");
    const editDurationInput = document.getElementById("editDurationInput");
    const editRepetitionsInput = document.getElementById("editRepetitionsInput");
    const editSessionsInput = document.getElementById("editSessionsInput");
    const cancelEditBtn = document.getElementById("cancelEditPlanBtn");
    const saveEditBtn = document.getElementById("saveEditPlanBtn");
    const templateCustomizeButtons = Array.from(document.querySelectorAll(".therapy-template-customize-btn"));
    const templatePopup = document.getElementById("therapyTemplatePopup");
    const templateBackdrop = document.getElementById("therapyTemplateBackdrop");
    const templateTitle = document.getElementById("therapyTemplateTitle");
    const templateAddExerciseBtn = document.getElementById("templateAddExerciseBtn");
    const cancelTemplateBtn = document.getElementById("cancelTemplateBtn");
    const saveTemplateBtn = document.getElementById("saveTemplateBtn");
    const removeTemplateExercise2Btn = document.getElementById("removeTemplateExercise2Btn");
    const removeTemplateExercise3Btn = document.getElementById("removeTemplateExercise3Btn");

    const TEMPLATE_STORAGE_KEY = "theraflow.therapyTemplateEditor.v1";
    const EXERCISE_TYPES = ["open_close", "full_extension", "full_close"];
    const EXERCISE_LABELS = {
        open_close: "Open-Close Exercise",
        full_extension: "Full Extension",
        full_close: "Full Close"
    };

    const templates = {
        level1: {
            label: "Level 1: Beginner",
            duration: 15,
            repetitions: 30,
            sessionsPerDay: 2,
            exercises: [{ type: "open_close", reps: 30, sessions: 2 }]
        },
        level2: {
            label: "Level 2: Intermediate",
            duration: 20,
            repetitions: 40,
            sessionsPerDay: 3,
            exercises: [{ type: "open_close", reps: 40, sessions: 3 }]
        },
        level3: {
            label: "Level 3: Advanced",
            duration: 25,
            repetitions: 55,
            sessionsPerDay: 3,
            exercises: [{ type: "open_close", reps: 55, sessions: 3 }]
        }
    };

    let assignments = [];
    let editingAssignmentId = "";
    let editingTemplateId = "";
    let editingPopupMode = "template";
    let templateRowCount = 1;
    let assignmentsPage = 1;
    let applyButtonSuccessTimer = null;

    const ASSIGNMENTS_PAGE_SIZE = 2;

    const templateRows = [
        {
            wrapper: document.querySelector('[data-template-row="1"]'),
            exercise: document.getElementById("templateExercise1Select"),
            reps: document.getElementById("templateReps1Input"),
            sessions: document.getElementById("templateSessions1Input")
        },
        {
            wrapper: document.getElementById("templateExerciseRow2"),
            exercise: document.getElementById("templateExercise2Select"),
            reps: document.getElementById("templateReps2Input"),
            sessions: document.getElementById("templateSessions2Input")
        },
        {
            wrapper: document.getElementById("templateExerciseRow3"),
            exercise: document.getElementById("templateExercise3Select"),
            reps: document.getElementById("templateReps3Input"),
            sessions: document.getElementById("templateSessions3Input")
        }
    ];

    function normalizeExerciseType(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return EXERCISE_TYPES.includes(normalized) ? normalized : "open_close";
    }

    function exerciseLabel(type) {
        return EXERCISE_LABELS[normalizeExerciseType(type)] || EXERCISE_LABELS.open_close;
    }

    function summarizeExercisePlan(exercises) {
        if (!Array.isArray(exercises) || !exercises.length) {
            return `
                <div class="template-plan-item">
                    <div class="template-plan-exercise">Open-Close Exercise</div>
                    <div class="template-plan-stats">
                        <div class="template-stat-chip"><span>Reps</span><strong>0</strong></div>
                        <div class="template-stat-chip"><span>Sessions</span><strong>0</strong></div>
                    </div>
                </div>
            `;
        }

        return exercises
            .map(item => {
                const label = exerciseLabel(item.type);
                const reps = Math.max(0, Number(item.reps || 0));
                const sessions = Math.max(0, Number(item.sessions || 0));
                return `
                    <div class="template-plan-item">
                        <div class="template-plan-exercise">${label}</div>
                        <div class="template-plan-stats">
                            <div class="template-stat-chip"><span>Reps</span><strong>${reps}</strong></div>
                            <div class="template-stat-chip"><span>Sessions</span><strong>${sessions}</strong></div>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = String(value);
        }
    }

    function setHtml(id, html) {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = String(html || "");
        }
    }

    function planBadgeClass(label) {
        const normalized = String(label || "").trim().toLowerCase();
        if (normalized.includes("level 1") || normalized === "level1") {
            return "plan-pill-level1";
        }
        if (normalized.includes("level 2") || normalized === "level2") {
            return "plan-pill-level2";
        }
        if (normalized.includes("level 3") || normalized === "level3") {
            return "plan-pill-level3";
        }
        if (normalized.includes("custom")) {
            return "plan-pill-custom";
        }
        return "plan-pill-default";
    }

    function renderPlanBadge(label) {
        const text = String(label || "Default");
        return `<span class="assignment-plan-pill ${planBadgeClass(text)}">${text}</span>`;
    }

    function summarizeAssignmentPlan(exercises, fallbackRepetitions) {
        if (!Array.isArray(exercises) || !exercises.length) {
            return `
                <ul class="assignment-metric-list">
                    <li>
                        <span class="assignment-metric-title">Open-Close Exercise</span>
                        <span class="assignment-metric-value">${Math.max(0, Number(fallbackRepetitions || 0))} reps</span>
                    </li>
                </ul>
            `;
        }

        return `
            <ul class="assignment-metric-list">
                ${exercises.map(item => `
                    <li>
                        <span class="assignment-metric-title">${exerciseLabel(item.type)}</span>
                        <span class="assignment-metric-value">${Math.max(0, Number(item.reps || 0))} reps</span>
                    </li>
                `).join("")}
            </ul>
        `;
    }

    function summarizeAssignmentSessions(exercises, fallbackSessions) {
        if (!Array.isArray(exercises) || !exercises.length) {
            const sessions = Math.max(0, Number(fallbackSessions || 0));
            const label = sessions === 1 ? "session" : "sessions";
            return `
                <ul class="assignment-metric-list assignment-metric-list-compact">
                    <li>
                        <span class="assignment-metric-value">${sessions} ${label}</span>
                    </li>
                </ul>
            `;
        }

        return `
            <ul class="assignment-metric-list assignment-metric-list-compact">
                ${exercises.map(item => {
                    const sessions = Math.max(0, Number(item.sessions || 0));
                    const label = sessions === 1 ? "session" : "sessions";
                    return `
                        <li>
                            <span class="assignment-metric-value">${sessions} ${label}</span>
                        </li>
                    `;
                }).join("")}
            </ul>
        `;
    }

    function updateTemplateStats(template) {
        const totalReps = (template.exercises || []).reduce((sum, item) => sum + Math.max(0, Number(item.reps || 0)), 0);
        const maxSessions = (template.exercises || []).reduce((max, item) => Math.max(max, Math.max(0, Number(item.sessions || 0))), 0);
        template.repetitions = Math.max(1, totalReps || Number(template.repetitions || 0) || 1);
        template.sessionsPerDay = Math.max(1, maxSessions || Number(template.sessionsPerDay || 0) || 1);
    }

    function sanitizeExercises(exercises, fallbackTemplate) {
        const next = [];
        const used = new Set();
        const source = Array.isArray(exercises) ? exercises : [];
        for (const item of source) {
            const type = normalizeExerciseType(item?.type);
            if (used.has(type)) {
                continue;
            }
            used.add(type);
            next.push({
                type,
                reps: Math.max(1, Number(item?.reps || 0)),
                sessions: Math.max(1, Number(item?.sessions || 0))
            });
            if (next.length >= 3) {
                break;
            }
        }

        if (!next.length) {
            const fallbackReps = Math.max(1, Number(fallbackTemplate?.repetitions || 30));
            const fallbackSessions = Math.max(1, Number(fallbackTemplate?.sessionsPerDay || 2));
            next.push({ type: "open_close", reps: fallbackReps, sessions: fallbackSessions });
        }

        return next;
    }

    function loadTemplateOverrides() {
        try {
            const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : null;
            if (!data || typeof data !== "object") {
                return;
            }

            ["level1", "level2", "level3"].forEach(templateId => {
                const source = data?.[templateId];
                if (!source || typeof source !== "object") {
                    return;
                }

                const exercises = sanitizeExercises(source.exercises, templates[templateId]);
                templates[templateId] = {
                    ...templates[templateId],
                    exercises
                };
                updateTemplateStats(templates[templateId]);
            });
        } catch {
            // Ignore invalid local template editor cache.
        }
    }

    function saveTemplateOverrides() {
        try {
            const payload = {
                level1: { exercises: templates.level1.exercises },
                level2: { exercises: templates.level2.exercises },
                level3: { exercises: templates.level3.exercises }
            };
            localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore storage errors.
        }
    }

    function renderTemplateCards() {
        setText("templateLevel1Title", templates.level1.label);
        setText("templateLevel2Title", templates.level2.label);
        setText("templateLevel3Title", templates.level3.label);
        setHtml("templateLevel1Plan", summarizeExercisePlan(templates.level1.exercises));
        setHtml("templateLevel2Plan", summarizeExercisePlan(templates.level2.exercises));
        setHtml("templateLevel3Plan", summarizeExercisePlan(templates.level3.exercises));
    }

    function renderTemplateSelectOptions() {
        if (!assignTemplateSelect) {
            return;
        }

        const selectedValue = String(assignTemplateSelect.value || "").trim();
        const templateOrder = ["level1", "level2", "level3"];
        assignTemplateSelect.innerHTML = templateOrder
            .map(templateId => {
                const template = templates[templateId];
                return `<option value="${templateId}">${template.label}</option>`;
            })
            .join("");
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Choose a difficulty level...";
        placeholder.disabled = true;
        assignTemplateSelect.insertBefore(placeholder, assignTemplateSelect.firstChild);
        assignTemplateSelect.value = templateOrder.includes(selectedValue) ? selectedValue : "";
    }

    function showApplySuccessState() {
        if (!applyTemplateBtn) {
            return;
        }

        if (applyButtonSuccessTimer) {
            clearTimeout(applyButtonSuccessTimer);
        }

        applyTemplateBtn.classList.add("is-success");

        applyButtonSuccessTimer = setTimeout(() => {
            applyTemplateBtn.classList.remove("is-success");
        }, 1600);
    }

    function updateTemplateRowVisibility() {
        templateRows.forEach((row, index) => {
            if (!row.wrapper) {
                return;
            }
            row.wrapper.hidden = index >= templateRowCount;
        });

        if (templateAddExerciseBtn) {
            const maxReached = templateRowCount >= 3;
            templateAddExerciseBtn.hidden = maxReached;
            templateAddExerciseBtn.disabled = maxReached;
        }
    }

    function updateExerciseOptionAvailability() {
        const activeRows = templateRows.slice(0, templateRowCount);
        const selectedTypes = activeRows.map(row => normalizeExerciseType(row.exercise?.value));

        activeRows.forEach((row, rowIndex) => {
            const select = row.exercise;
            if (!select) {
                return;
            }

            const ownType = selectedTypes[rowIndex];
            const usedElsewhere = new Set(
                selectedTypes.filter((selectedType, index) => index !== rowIndex && selectedType)
            );
            const allowedTypes = EXERCISE_TYPES.filter(type => type === ownType || !usedElsewhere.has(type));
            const nextValue = allowedTypes.includes(ownType) ? ownType : (allowedTypes[0] || "open_close");

            select.innerHTML = allowedTypes
                .map(type => `<option value="${type}">${exerciseLabel(type)}</option>`)
                .join("");
            select.value = nextValue;

            selectedTypes[rowIndex] = nextValue;
        });
    }

    function openTemplatePopup(templateId) {
        const template = templates[templateId];
        if (!template || !templatePopup) {
            return;
        }

        editingTemplateId = templateId;
        editingAssignmentId = "";
        editingPopupMode = "template";
        if (templateTitle) {
            templateTitle.textContent = "Customize Standard Template";
        }
        const exercises = sanitizeExercises(template.exercises, template);
        templateRowCount = Math.min(3, Math.max(1, exercises.length));

        templateRows.forEach((row, index) => {
            const data = exercises[index];
            if (data) {
                if (row.exercise) {
                    row.exercise.value = normalizeExerciseType(data.type);
                }
                if (row.reps) {
                    row.reps.value = String(Math.max(1, Number(data.reps || 1)));
                }
                if (row.sessions) {
                    row.sessions.value = String(Math.max(1, Number(data.sessions || 1)));
                }
                return;
            }

            const firstAvailable = EXERCISE_TYPES.find(type => !exercises.some(item => normalizeExerciseType(item.type) === type)) || "open_close";
            if (row.exercise) {
                row.exercise.value = firstAvailable;
            }
            if (row.reps) {
                row.reps.value = "10";
            }
            if (row.sessions) {
                row.sessions.value = "1";
            }
        });

        updateTemplateRowVisibility();
        updateExerciseOptionAvailability();
        templatePopup.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeTemplatePopup() {
        if (!templatePopup) {
            return;
        }

        templatePopup.hidden = true;
        editingTemplateId = "";
        editingAssignmentId = "";
        editingPopupMode = "template";
        if (templateTitle) {
            templateTitle.textContent = "Customize Standard Template";
        }
        document.body.style.overflow = "";
    }

    function openAssignPlanModal() {
        if (!assignPopup) {
            return;
        }

        assignPopup.hidden = false;
        document.body.style.overflow = "hidden";
        assignPatientSelect?.focus();
    }

    function closeAssignPlanModal() {
        if (!assignPopup) {
            return;
        }

        assignPopup.hidden = true;
        document.body.style.overflow = "";
    }

    function addTemplateExerciseRow() {
        if (templateRowCount >= 3) {
            return;
        }

        templateRowCount += 1;
        const activeTypes = templateRows
            .slice(0, templateRowCount - 1)
            .map(row => normalizeExerciseType(row.exercise?.value));
        const nextType = EXERCISE_TYPES.find(type => !activeTypes.includes(type)) || "open_close";
        const row = templateRows[templateRowCount - 1];
        if (row.exercise) {
            row.exercise.value = nextType;
        }

        updateTemplateRowVisibility();
        updateExerciseOptionAvailability();
    }

    function removeTemplateExerciseRow(index) {
        if (index < 1 || index > 2) {
            return;
        }

        if (templateRowCount <= index) {
            return;
        }

        for (let i = index; i < templateRowCount - 1; i += 1) {
            const current = templateRows[i];
            const next = templateRows[i + 1];
            if (current.exercise && next.exercise) {
                current.exercise.value = next.exercise.value;
            }
            if (current.reps && next.reps) {
                current.reps.value = next.reps.value;
            }
            if (current.sessions && next.sessions) {
                current.sessions.value = next.sessions.value;
            }
        }

        templateRowCount -= 1;
        updateTemplateRowVisibility();
        updateExerciseOptionAvailability();
    }

    function collectTemplateEditorValues() {
        const rows = templateRows.slice(0, templateRowCount);
        const nextExercises = [];
        const used = new Set();

        for (const row of rows) {
            const type = normalizeExerciseType(row.exercise?.value);
            const reps = Math.max(1, Number(row.reps?.value || 0));
            const sessions = Math.max(1, Number(row.sessions?.value || 0));
            if (used.has(type)) {
                return { ok: false, error: "Exercise type must not repeat." };
            }
            used.add(type);
            nextExercises.push({ type, reps, sessions });
        }

        if (!nextExercises.length) {
            return { ok: false, error: "At least one exercise is required." };
        }

        return { ok: true, exercises: nextExercises };
    }

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

        if (!assignments.length) {
            assignPatientSelect.innerHTML = '<option value="" selected disabled>No patients available</option>';
            return;
        }

        assignPatientSelect.innerHTML = [
            '<option value="" selected disabled>Search for a patient...</option>',
            ...assignments.map(assignment => `<option value="${assignment.id}">${assignment.patientName}</option>`)
        ].join("");
    }

    function renderAssignments() {
        if (!assignmentsBody) {
            return;
        }

        const totalPages = Math.max(1, Math.ceil(assignments.length / ASSIGNMENTS_PAGE_SIZE));
        assignmentsPage = Math.min(totalPages, Math.max(1, assignmentsPage));
        const startIndex = (assignmentsPage - 1) * ASSIGNMENTS_PAGE_SIZE;
        const pageItems = assignments.slice(startIndex, startIndex + ASSIGNMENTS_PAGE_SIZE);

        assignmentsBody.innerHTML = pageItems.length
            ? pageItems.map(assignment => `
                <tr class="assignment-row-strip">
                    <td class="assignment-patient-cell"><span class="assignment-patient-name">${assignment.patientName}</span></td>
                    <td class="assignment-plan-status-cell">${renderPlanBadge(assignment.label || "Default")}</td>
                    <td class="assignment-plan-cell">${summarizeAssignmentPlan(assignment.exercises, assignment.repetitions)}</td>
                    <td class="assignment-sessions-cell">${summarizeAssignmentSessions(assignment.exercises, assignment.sessionsPerDay)}</td>
                    <td class="assignment-action-cell">
                        <button type="button" class="therapy-edit-btn" data-assignment-id="${assignment.id}" aria-label="Edit ${assignment.patientName} assignment">
                            <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                            <span>Edit</span>
                        </button>
                    </td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="5" class="assignment-empty-cell">
                        <div class="assignment-empty-state">
                            <p class="assignment-empty-title">No active assignments found</p>
                            <p class="assignment-empty-copy">Start by selecting a patient and applying a template.</p>
                            <button type="button" class="doctor-btn assignment-empty-cta" id="assignmentEmptyCta">Assign First Plan</button>
                        </div>
                    </td>
                </tr>
            `;

        if (assignmentsPagination && assignmentsPrevBtn && assignmentsNextBtn && assignmentsPageLabel) {
            const hasPagination = assignments.length > ASSIGNMENTS_PAGE_SIZE;
            assignmentsPagination.hidden = !hasPagination;
            assignmentsPrevBtn.disabled = assignmentsPage <= 1;
            assignmentsPrevBtn.style.visibility = assignmentsPage <= 1 ? "hidden" : "visible";
            assignmentsNextBtn.disabled = assignmentsPage >= totalPages;
            assignmentsPageLabel.textContent = `Page ${assignmentsPage} of ${totalPages}`;
        }
    }

    function loadAssignments() {
        fetch("api/doctor/therapy_plans.php")
            .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load therapy plans.")))
            .then(payload => {
                if (!payload?.ok) {
                    throw new Error(payload?.error || "Unable to load therapy plans.");
                }

                assignments = (payload.assignments || []).map(row => {
                    let parsedBundle = null;
                    try {
                        parsedBundle = typeof row.exercise_bundle_json === "string"
                            ? JSON.parse(row.exercise_bundle_json || "null")
                            : row.exercise_bundle_json;
                    } catch {
                        parsedBundle = null;
                    }

                    const sessionsPerDay = Number(row.sessions_per_day || 0);
                    const exercises = parsedBundle && typeof parsedBundle === "object"
                        ? ["open_close", "full_extension", "full_close"].map(type => {
                            const raw = parsedBundle[type];
                            const reps = raw && typeof raw === "object"
                                ? Number(raw.reps || 0)
                                : Number(raw || 0);
                            const perExerciseSessions = raw && typeof raw === "object"
                                ? Number(raw.sessions || sessionsPerDay || 0)
                                : sessionsPerDay;
                            return { type, reps, sessions: perExerciseSessions };
                        }).filter(item => item.reps > 0)
                        : [];

                    return {
                        id: String(row.patient_id),
                        patientId: Number(row.patient_id),
                        patientName: String(row.patient_name || "Patient"),
                        templateId: templateKeyByLabel(row.template_name),
                        label: row.template_name || "Default",
                        duration: Number(row.duration_min || 0),
                        repetitions: Number(row.target_repetitions || 0),
                        sessionsPerDay,
                        exercises
                    };
                });

                assignmentsPage = 1;
                populatePatientSelect();
                renderAssignments();
            })
            .catch(() => {
                assignments = [];
                assignmentsPage = 1;
                populatePatientSelect();
                renderAssignments();
                if (assignFeedback) {
                    assignFeedback.textContent = "Unable to load therapy plans right now.";
                }
            });
    }

    function openEditPopup(assignmentId) {
        const assignment = assignments.find(item => item.id === assignmentId);
        if (!assignment || !templatePopup) {
            return;
        }

        editingAssignmentId = assignment.id;
        editingTemplateId = "";
        editingPopupMode = "assignment";
        if (templateTitle) {
            templateTitle.textContent = `Customize Plan: ${assignment.patientName}`;
        }

        const fallbackExercises = [{
            type: "open_close",
            reps: Math.max(1, Number(assignment.repetitions || 1)),
            sessions: Math.max(1, Number(assignment.sessionsPerDay || 1))
        }];
        const exercises = sanitizeExercises(
            Array.isArray(assignment.exercises) && assignment.exercises.length ? assignment.exercises : fallbackExercises,
            assignment
        );

        templateRowCount = Math.min(3, Math.max(1, exercises.length));
        templateRows.forEach((row, index) => {
            const data = exercises[index];
            if (data) {
                if (row.exercise) row.exercise.value = normalizeExerciseType(data.type);
                if (row.reps) row.reps.value = String(Math.max(1, Number(data.reps || 1)));
                if (row.sessions) row.sessions.value = String(Math.max(1, Number(data.sessions || 1)));
                return;
            }

            if (row.exercise) row.exercise.value = "open_close";
            if (row.reps) row.reps.value = "10";
            if (row.sessions) row.sessions.value = "1";
        });

        updateTemplateRowVisibility();
        updateExerciseOptionAvailability();
        templatePopup.hidden = false;
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
        const ctaButton = event.target instanceof HTMLElement ? event.target.closest("#assignmentEmptyCta") : null;
        if (ctaButton) {
            openAssignPlanModal();
            return;
        }

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

        if (!selectedPatientId) {
            if (assignFeedback) {
                assignFeedback.textContent = "Select a patient before applying a template.";
            }
            assignPatientSelect.focus();
            return;
        }

        if (!selectedTemplateId) {
            if (assignFeedback) {
                assignFeedback.textContent = "Choose a difficulty level before applying.";
            }
            assignTemplateSelect.focus();
            return;
        }

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
            const exerciseBundle = {
                open_close: { reps: 0, sessions: 0 },
                full_extension: { reps: 0, sessions: 0 },
                full_close: { reps: 0, sessions: 0 }
            };
            (selectedTemplate.exercises || []).forEach(item => {
                const type = normalizeExerciseType(item.type);
                exerciseBundle[type].reps += Math.max(0, Number(item.reps || 0));
                exerciseBundle[type].sessions = Math.max(exerciseBundle[type].sessions, Math.max(0, Number(item.sessions || 0)));
            });

            void fetch("api/doctor/therapy_plans.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: active.patientId,
                    templateName: selectedTemplate.label,
                    durationMin: active.duration,
                    targetRepetitions: active.repetitions,
                    sessionsPerDay: active.sessionsPerDay,
                    exerciseBundle
                })
            });
        }

        if (assignFeedback) {
            const name = assignments.find(item => item.id === selectedPatientId)?.patientName || "Patient";
            assignFeedback.textContent = `${selectedTemplate.label} assigned to ${name}.`;
        }

        showApplySuccessState();
    });

    templateCustomizeButtons.forEach(button => {
        button.addEventListener("click", () => {
            const templateId = String(button.getAttribute("data-template-id") || "").trim();
            if (!templateId) {
                return;
            }
            openTemplatePopup(templateId);
        });
    });

    templateRows.forEach(row => {
        row.exercise?.addEventListener("change", updateExerciseOptionAvailability);
    });

    openAssignPlanModalBtn?.addEventListener("click", openAssignPlanModal);
    closeAssignPlanModalBtn?.addEventListener("click", closeAssignPlanModal);
    assignBackdrop?.addEventListener("click", closeAssignPlanModal);

    templateAddExerciseBtn?.addEventListener("click", addTemplateExerciseRow);
    removeTemplateExercise2Btn?.addEventListener("click", () => removeTemplateExerciseRow(1));
    removeTemplateExercise3Btn?.addEventListener("click", () => removeTemplateExerciseRow(2));

    saveTemplateBtn?.addEventListener("click", () => {
        const collected = collectTemplateEditorValues();
        if (!collected.ok) {
            if (assignFeedback) {
                assignFeedback.textContent = collected.error || "Invalid exercise settings.";
            }
            return;
        }

        if (editingPopupMode === "assignment") {
            const nextExercises = collected.exercises;
            const nextRepetitions = nextExercises.reduce((sum, item) => sum + Math.max(0, Number(item.reps || 0)), 0);
            const nextSessionsPerDay = nextExercises.reduce((max, item) => Math.max(max, Math.max(1, Number(item.sessions || 1))), 1);

            assignments = assignments.map(assignment => {
                if (assignment.id !== editingAssignmentId) {
                    return assignment;
                }

                return {
                    ...assignment,
                    label: "Custom",
                    exercises: nextExercises,
                    repetitions: nextRepetitions,
                    sessionsPerDay: nextSessionsPerDay
                };
            });

            renderAssignments();

            const active = assignments.find(item => item.id === editingAssignmentId);
            if (active) {
                const exerciseBundle = {
                    open_close: { reps: 0, sessions: 0 },
                    full_extension: { reps: 0, sessions: 0 },
                    full_close: { reps: 0, sessions: 0 }
                };
                nextExercises.forEach(item => {
                    const type = normalizeExerciseType(item.type);
                    exerciseBundle[type].reps += Math.max(0, Number(item.reps || 0));
                    exerciseBundle[type].sessions = Math.max(exerciseBundle[type].sessions, Math.max(0, Number(item.sessions || 0)));
                });

                void fetch("api/doctor/therapy_plans.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patientId: active.patientId,
                        templateName: "Custom",
                        durationMin: active.duration,
                        targetRepetitions: active.repetitions,
                        sessionsPerDay: active.sessionsPerDay,
                        exerciseBundle
                    })
                });
            }

            if (assignFeedback) {
                assignFeedback.textContent = "Patient plan updated.";
            }
            closeTemplatePopup();
            return;
        }

        const template = templates[editingTemplateId];
        if (!template) {
            return;
        }

        template.exercises = collected.exercises;
        updateTemplateStats(template);
        saveTemplateOverrides();
        renderTemplateCards();
        renderTemplateSelectOptions();
        if (assignFeedback) {
            assignFeedback.textContent = `${template.label} updated.`;
        }
        closeTemplatePopup();
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
    cancelTemplateBtn?.addEventListener("click", closeTemplatePopup);
    templateBackdrop?.addEventListener("click", closeTemplatePopup);
    assignmentsPrevBtn?.addEventListener("click", () => {
        assignmentsPage = Math.max(1, assignmentsPage - 1);
        renderAssignments();
    });
    assignmentsNextBtn?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(assignments.length / ASSIGNMENTS_PAGE_SIZE));
        assignmentsPage = Math.min(totalPages, assignmentsPage + 1);
        renderAssignments();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && assignPopup && !assignPopup.hidden) {
            closeAssignPlanModal();
        }
        if (event.key === "Escape" && editPopup && !editPopup.hidden) {
            closeEditPopup();
        }
        if (event.key === "Escape" && templatePopup && !templatePopup.hidden) {
            closeTemplatePopup();
        }
    });

    loadTemplateOverrides();
    renderTemplateCards();
    renderTemplateSelectOptions();
    loadAssignments();
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
    const stepperViewport = document.getElementById("exerciseStepperViewport");
    const backStepBtn = document.getElementById("hubStepBackBtn");
    const retryStepBtn = document.getElementById("hubStepRetryBtn");
    const nextStepBtn = document.getElementById("hubStepNextBtn");

    // Step nav dots (optional; dot nav may be hidden/removed)
    const navDots = Array.from(document.querySelectorAll(".wizard-step-dot"));

    // Step panels
    const stepPair      = document.getElementById("stepPair");
    const stepCalibrate = document.getElementById("stepCalibrate");
    const stepTest      = document.getElementById("stepTest");
    const stepDiagnose  = document.getElementById("stepDiagnose");
    const stepSession   = document.getElementById("stepSession");
    const stepPanels    = [stepPair, stepCalibrate, stepTest, stepDiagnose, stepSession];

    // Step 1 — Pair
    const pairButton    = document.getElementById("hubPairButton");
    const pairStatus    = document.getElementById("hubPairStatus");
    const patientIdHint  = document.getElementById("hubPatientIdHint");
    const searchingAnim = document.getElementById("searchingAnimation");
    const searchingLabel = document.getElementById("searchingLabel");

    // Step 2 — Calibrate
    const calibrateBtn      = document.getElementById("hubCalibrateBtn");
    const calibrationProgressFill = document.getElementById("hubCalibrationProgressFill");
    const calibrationProgressLabel = document.getElementById("hubCalibrationProgressLabel");
    const calibrationGrid   = document.getElementById("calibrationFingerGrid");
    const calibrationStatus = document.getElementById("hubCalibrationStatus");
    const calibrationPrompt = document.getElementById("calibrationPrompt");

    // Step 3 — Testing Stage
    const testRepsEl        = document.getElementById("hubTestReps");
    const testMovementEl    = document.getElementById("hubTestMovement");
    const testForceEl       = document.getElementById("hubTestForce");
    const testTimeEl        = document.getElementById("hubTestTime");
    const testForceDialEl   = document.getElementById("hubTestForceDial");
    const testRingProgressEl = document.getElementById("hubTestRingProgress");
    const testFingerGaugeCells = Array.from(document.querySelectorAll("#hubTestFingerGauges .test-gauge-cell"));
    const startTestBtn      = document.getElementById("hubStartTestBtn");
    const stopTestBtn       = document.getElementById("hubStopTestBtn");
    const testStatus        = document.getElementById("hubTestStatus");

    // Step 3 — Select Exercise (Therapy Mode)
    const diagStatus         = document.getElementById("hubDiagStatus");
    const exerciseChoiceGrid = document.getElementById("exerciseChoiceGrid");
    const exerciseCards      = Array.from(exerciseChoiceGrid?.querySelectorAll("[data-exercise-type]") || []);
    const speedWrap          = document.getElementById("exerciseSpeedWrap");
    const holdWrap           = document.getElementById("exerciseHoldWrap");
    const speedButtons       = Array.from(document.querySelectorAll("#exerciseSpeedGroup [data-speed]"));
    const holdButtons        = Array.from(document.querySelectorAll("#exerciseHoldGroup [data-hold-seconds]"));
    const therapyDurationEl  = document.getElementById("hubTherapyDuration");
    const therapyRepsEl      = document.getElementById("hubTherapyReps");

    if (speedWrap) speedWrap.hidden = true;
    if (holdWrap) holdWrap.hidden = true;

    // Step 4 — Session
    const sessionIntro      = document.getElementById("hubSessionIntro");
    const targetRepsEl      = document.getElementById("hubTargetReps");
    const sessionExerciseEl = document.getElementById("hubSessionExercise");
    const sessionRepsEl     = document.getElementById("hubSessionReps");
    const sessionMovementEl = document.getElementById("hubSessionMovement");
    const sessionForceEl    = document.getElementById("hubSessionForce");
    const sessionTimeEl     = document.getElementById("hubSessionTime");
    const repsRingProgressEl = document.getElementById("hubRepsRingProgress");
    const startSessionBtn   = document.getElementById("hubStartSessionBtn");
    const endSessionBtn     = document.getElementById("hubEndSessionBtn");
    const sessionStatus     = document.getElementById("hubSessionStatus");
    const summaryModal      = document.getElementById("hubSessionSummaryModal");
    const summaryResultEl   = document.getElementById("hubSessionSummaryResult");
    const summaryExerciseEl = document.getElementById("hubSummaryExercise");
    const summaryRepsEl     = document.getElementById("hubSummaryReps");
    const summaryTargetEl   = document.getElementById("hubSummaryTarget");
    const summaryForceEl    = document.getElementById("hubSummaryForce");
    const summaryFlexionEl  = document.getElementById("hubSummaryFlexion");
    const summaryDurationEl = document.getElementById("hubSummaryDuration");
    const summaryDoneBtn    = document.getElementById("hubSummaryDoneBtn");
    const summaryCloseBtn   = document.getElementById("hubSessionSummaryClose");

    // ── State ─────────────────────────────────────────────────────────────────
    let gloveConnected = false;
    let currentPatientId = null;
    const fingerNames = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
    const calibrationState = fingerNames.map(name => ({ name, zero: null, max: null, current: 0 }));
    const diagResults = { maxExtension: 0, maxFlexion: 0, peakForce: 0 };
    const defaultAssessmentStageName = "Initial Baseline";
    let planTargetReps = 120;
    let planDurationMin = 15;
    let calibrationPhase = "zero";
    let calibrationComplete = false;
    let calibrationRequested = false;
    let calibrationPollTimer = null;
    let calibrationRequestedAt = 0;
    let sessionPrepared = false;
    let selectedExercise = "";
    let selectedSpeed = "normal";
    let selectedHoldSeconds = 5;
    let exerciseConfirmed = false;
    let testCompleted = false;
    let currentStep = 1;

    const testState = {
        isRunning: false,
        reps: 0,
        totalForce: 0,
        sampleCount: 0,
        bestFlexion: 0,
        peakForce: 0,
        startTime: null,
        intervalId: null,
        motionPhase: "",
        lastReadingId: 0,
        lastReadingAt: "",
        lastReadingTs: 0
    };

    const sessionState = {
        isRunning: false,
        targetRepetitions: 120,
        reps: 0,
        totalForce: 0,
        sampleCount: 0,
        startTime: null,
        intervalId: null,
        holdProgressSeconds: 0,
        motionPhase: "",
        lastReadingId: 0,
        lastReadingAt: "",
        lastReadingTs: 0
    };

    const TEST_SHOTCLOCK_SECONDS = 30;

    const exerciseLabelMap = {
        open_close_hand: "Open-Close Hand",
        full_grip_hold: "Full Grip (Hold)",
        full_extension_hold: "Full Extension (Hold)"
    };

    function isHoldExercise(type) {
        return type === "full_grip_hold" || type === "full_extension_hold";
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function setMsg(el, text) {
        if (el) el.textContent = text;
    }

    function formatDuration(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const mm = Math.floor(safeSeconds / 60);
        const ss = String(safeSeconds % 60).padStart(2, "0");
        return `${mm}:${ss}`;
    }

    function formatShotClock(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        return String(safeSeconds).padStart(2, "0");
    }

    function openSessionSummaryModal(summary) {
        if (!summaryModal) return;

        setMsg(summaryResultEl, `Session saved with result: ${summary.result}.`);
        setMsg(summaryExerciseEl, summary.exerciseLabel || "-");
        setMsg(summaryRepsEl, String(summary.repetitions || 0));
        setMsg(summaryTargetEl, String(summary.target || 0));
        setMsg(summaryForceEl, `${Number(summary.avgForce || 0).toFixed(1)} N`);
        setMsg(summaryFlexionEl, `${Number(summary.maxFlexion || 0).toFixed(1)}°`);
        setMsg(summaryDurationEl, formatDuration(summary.durationSeconds));

        summaryModal.hidden = false;
        summaryModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("graph-modal-open");
    }

    function closeSessionSummaryModal() {
        if (!summaryModal) return;
        summaryModal.hidden = true;
        summaryModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("graph-modal-open");
    }

    function finalizeSessionSummaryAndReset() {
        closeSessionSummaryModal();
        resetCalibrationFlow();
    }

    function setCalibrationProgress(percent) {
        const p = Math.max(0, Math.min(100, Number(percent) || 0));
        if (calibrationProgressFill) {
            calibrationProgressFill.style.width = `${p}%`;
        }
        if (calibrationProgressLabel) {
            calibrationProgressLabel.textContent = `${Math.round(p)}%`;
        }
    }

    function renderPatientIdHint() {
        if (!patientIdHint) return;
        patientIdHint.hidden = true;
    }

    function toNumericArray(value) {
        if (!Array.isArray(value)) return [];
        return value.filter(item => Number.isFinite(Number(item))).map(item => Number(item));
    }

    function averageOf(values) {
        const numbers = toNumericArray(values);
        if (!numbers.length) {
            return null;
        }

        return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }

    function classifyLiveMovement(movementDeg, profile) {
        const straightValues = toNumericArray(profile?.straight_values || profile?.straightValues || profile?.open_values || profile?.openValues);
        const bendValues = toNumericArray(profile?.bend_values || profile?.bendValues || profile?.closed_values || profile?.closedValues);
        const openReference = averageOf(straightValues);
        const closeReference = averageOf(bendValues);

        const hasReferences = Number.isFinite(openReference) && Number.isFinite(closeReference) && closeReference !== openReference;
        const openDeg = hasReferences ? openReference : 0;
        const closeDeg = hasReferences ? closeReference : 90;
        const span = Math.max(1, closeDeg - openDeg);
        const normalizedDeg = Math.max(0, Math.min(90, ((movementDeg - openDeg) / span) * 90));
        const openThreshold = openDeg + (span * 0.15);
        const closeThreshold = openDeg + (span * 0.85);

        let phase = "middle";
        if (movementDeg <= openThreshold) {
            phase = "open";
        } else if (movementDeg >= closeThreshold) {
            phase = "close";
        }

        return {
            phase,
            normalizedDeg,
            openReference,
            closeReference
        };
    }

    function applyCalibrationProfile(profile) {
        if (!profile || typeof profile !== "object") {
            return false;
        }

        const straightValues = toNumericArray(profile.straight_values || profile.straightValues || profile.open_values || profile.openValues);
        const bendValues = toNumericArray(profile.bend_values || profile.bendValues || profile.closed_values || profile.closedValues);

        if (!straightValues.length && !bendValues.length) {
            return false;
        }

        calibrationState.forEach((finger, index) => {
            if (Number.isFinite(straightValues[index])) {
                finger.zero = straightValues[index];
            }
            if (Number.isFinite(bendValues[index])) {
                finger.max = bendValues[index];
            }
            if (finger.max !== null) {
                finger.current = Number(finger.max);
            } else if (finger.zero !== null) {
                finger.current = Number(finger.zero);
            }
        });

        renderCalibrationGrid();

        try {
            const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
            gloveData.calibrationProfile = {
                straight_values: straightValues,
                bend_values: bendValues,
                grip_min: Number.isFinite(Number(profile.grip_min ?? profile.gripMin)) ? Number(profile.grip_min ?? profile.gripMin) : null,
                grip_max: Number.isFinite(Number(profile.grip_max ?? profile.gripMax)) ? Number(profile.grip_max ?? profile.gripMax) : null,
                finger_names: Array.isArray(profile.finger_names) ? profile.finger_names : fingerNames
            };
            localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
        } catch {
            // Storage may be unavailable.
        }

        return true;
    }

    async function loadLatestCalibrationProfile() {
        if (!currentPatientId) {
            return null;
        }

        try {
            const response = await fetch("api/patient/exercise_session.php", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                return null;
            }

            if (payload?.calibrationProfile) {
                applyCalibrationProfile(payload.calibrationProfile);
            }

            return payload.calibrationProfile || null;
        } catch {
            return null;
        }
    }

    async function loadPatientContext() {
        try {
            const response = await fetch("api/patient/profile_details.php", { cache: "no-store" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || "Unable to load patient context");
            }

            currentPatientId = Number(payload.patient_id || 0) || null;
        } catch {
            currentPatientId = null;
        }

        renderPatientIdHint();
        void loadLatestCalibrationProfile();
        return currentPatientId;
    }

    async function requestGloveCalibration() {
        if (!currentPatientId) {
            await loadPatientContext();
        }

        if (!currentPatientId) {
            throw new Error("Patient ID not loaded yet. Refresh the page and try again.");
        }

        const response = await fetch("api/iot/calibration_command.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patient_id: currentPatientId,
                command: "calibrate"
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to request calibration");
        }

        return payload;
    }

    async function requestGloveCommand(command) {
        if (!currentPatientId) {
            throw new Error("Patient ID not loaded yet.");
        }

        const response = await fetch("api/iot/calibration_command.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patient_id: currentPatientId,
                command
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || `Unable to send ${command} command`);
        }

        return payload;
    }

    async function fetchCalibrationCommandStatus() {
        if (!currentPatientId) {
            return null;
        }

        const response = await fetch(`api/iot/calibration_command.php?patient_id=${currentPatientId}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to load calibration status");
        }

        return payload.command || null;
    }

    function stopCalibrationPolling() {
        if (calibrationPollTimer) {
            clearInterval(calibrationPollTimer);
            calibrationPollTimer = null;
        }
    }

    function syncCalibrationButtonState() {
        if (!calibrateBtn) return;
        calibrateBtn.disabled = calibrationRequested || calibrationPollTimer !== null || calibrationComplete;
    }

    async function pollCalibrationUntilComplete() {
        try {
            const command = await fetchCalibrationCommandStatus();
            if (!command) {
                setMsg(calibrationStatus, "Waiting for the glove to receive the calibration request...");
                return;
            }

            if (command.status === "completed") {
                stopCalibrationPolling();
                calibrationRequested = false;
                calibrationComplete = true;
                syncCalibrationButtonState();
                applyCalibrationProfile(command?.payload?.calibration || command?.payload || {});
                renderCalibrationGrid();
                setCalibrationProgress(100);
                setMsg(calibrationStatus, "Calibration complete. You can continue to Step 3.");
                updateStepNavigationState();
                goToStep(3);
                loadTherapyPlan();
                return;
            }

            if (command.status === "in_progress") {
                const phase = String(command?.payload?.phase || "");
                const secondsRemaining = Number(command?.payload?.seconds_remaining || 0);

                const phaseDurations = {
                    suction: 5,
                    pump: 5,
                    deflate: 5
                };

                const totalSeconds = phaseDurations.suction + phaseDurations.pump + phaseDurations.deflate;

                function setProgressFromPhase(activePhase, remaining) {
                    const consumed = {
                        suction: 0,
                        pump: phaseDurations.suction,
                        deflate: phaseDurations.suction + phaseDurations.pump
                    };

                    const elapsedInPhase = Math.max(0, phaseDurations[activePhase] - Math.max(0, remaining));
                    const elapsedTotal = (consumed[activePhase] || 0) + elapsedInPhase;
                    setCalibrationProgress((elapsedTotal / totalSeconds) * 100);
                }

                if (phase === "full_extension_hold") {
                    calibrationState.forEach(finger => {
                        finger.current = 0;
                    });
                    renderCalibrationGrid();
                    setCalibrationProgress(((5 - Math.max(0, secondsRemaining)) / 10) * 100);
                    setMsg(calibrationStatus, `Calibration Step 1/2: Fully extend your hand (${secondsRemaining}s remaining).`);
                    return;
                }

                if (phase === "full_close_hold") {
                    calibrationState.forEach(finger => {
                        finger.current = 90;
                    });
                    renderCalibrationGrid();
                    setCalibrationProgress((5 + (5 - Math.max(0, secondsRemaining))) / 10 * 100);
                    setMsg(calibrationStatus, `Calibration Step 2/2: Fully close your hand (${secondsRemaining}s remaining).`);
                    return;
                }

                if (phase === "suction") {
                    calibrationState.forEach(finger => {
                        finger.current = 0;
                    });
                    renderCalibrationGrid();
                    setProgressFromPhase("suction", secondsRemaining);
                    setMsg(calibrationStatus, `Calibration (Auto) Phase 1/3: Opening hand with suction (${secondsRemaining}s remaining).`);
                    return;
                }

                if (phase === "pump") {
                    calibrationState.forEach(finger => {
                        finger.current = 90;
                    });
                    renderCalibrationGrid();
                    setProgressFromPhase("pump", secondsRemaining);
                    setMsg(calibrationStatus, `Calibration (Auto) Phase 2/3: Closing hand with pump (${secondsRemaining}s remaining).`);
                    return;
                }

                if (phase === "deflate") {
                    calibrationState.forEach(finger => {
                        finger.current = 0;
                    });
                    renderCalibrationGrid();
                    setProgressFromPhase("deflate", secondsRemaining);
                    setMsg(calibrationStatus, `Calibration (Auto) Phase 3/3: Deflating glove (${secondsRemaining}s remaining).`);
                    return;
                }

                setMsg(calibrationStatus, "Calibration in progress on glove...");
                return;
            }

            if (command.status === "dispatched" || command.status === "pending") {
                const ageMs = calibrationRequestedAt > 0 ? Date.now() - calibrationRequestedAt : 0;
                if (ageMs > 9000) {
                    setMsg(calibrationStatus, `No glove response yet. Make sure ESP32 patientId matches your web patient ID (${currentPatientId ?? "unknown"}) and that the glove is online.`);
                    return;
                }

                setMsg(calibrationStatus, "Calibration running automatically on the glove actuators...");
                syncCalibrationButtonState();
            }
        } catch {
            setMsg(calibrationStatus, "Waiting for calibration status from the glove...");
        }
    }

    async function fetchLatestGloveReading() {
        const response = await fetch("api/patient/exercise_session.php", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || "Unable to read glove sensor data.");
        }

        const row = payload?.lastReading;
        if (!row) {
            if (payload?.calibrationProfile) {
                applyCalibrationProfile(payload.calibrationProfile);
            }
            return null;
        }

        if (payload?.calibrationProfile) {
            applyCalibrationProfile(payload.calibrationProfile);
        }

        return {
            id: Number(row.id || 0),
            force: Number(row.grip_strength || 0),
            movement: Number(row.flexion_angle || 0),
            recordedAt: String(row.recorded_at || row.recordedAt || ""),
            calibrationProfile: payload?.calibrationProfile || null,
            fingerAngles: row.finger_angles && typeof row.finger_angles === "object" ? row.finger_angles : null
        };
    }

    async function refreshGloveConnectionState({ showStatus = false } = {}) {
        try {
            const response = await fetch("api/iot/handshake_status.php", { cache: "no-store", credentials: "same-origin" });
            const payload = await response.json().catch(() => ({}));
            const connected = Boolean(response.ok && payload?.ok && payload?.handshake === true);

            gloveConnected = connected;
            updateStepNavigationState();

            if (connected) {
                const gloveName = "Theraflow Glove";
                announceGlovePaired(gloveName);
                if (showStatus || currentStep === 1) {
                    setMsg(searchingLabel, `Connected to ${gloveName} over Wi-Fi.`);
                    if (searchingAnim) searchingAnim.classList.remove("is-searching");
                    if (searchingAnim) searchingAnim.classList.add("is-connected");
                }
            } else {
                announceGloveOffline();
                if (showStatus || currentStep === 1) {
                    setMsg(searchingLabel, "Searching for Glove...");
                    if (searchingAnim) searchingAnim.classList.add("is-searching");
                    if (searchingAnim) searchingAnim.classList.remove("is-connected");
                }
            }

            return connected;
        } catch {
            gloveConnected = false;
            announceGloveOffline();
            updateStepNavigationState();
            if (showStatus || currentStep === 1) {
                setMsg(searchingLabel, "Searching for Glove...");
                if (searchingAnim) searchingAnim.classList.add("is-searching");
                if (searchingAnim) searchingAnim.classList.remove("is-connected");
            }
            return false;
        }
    }

    // ── Step navigation ───────────────────────────────────────────────────────
    function updateSessionProgressRing(reps) {
        if (!repsRingProgressEl) return;
        const target = Math.max(1, Number(sessionState.targetRepetitions || planTargetReps || 1));
        const progress = Math.max(0, Math.min(1, reps / target));
        const radius = Number(repsRingProgressEl.getAttribute("r") || 46);
        const circumference = 2 * Math.PI * radius;
        repsRingProgressEl.style.strokeDasharray = `${circumference.toFixed(2)} ${circumference.toFixed(2)}`;
        repsRingProgressEl.style.strokeDashoffset = `${(circumference * (1 - progress)).toFixed(2)}`;
    }

    function updateTestProgressRing(reps) {
        if (!testRingProgressEl) return;
        const progress = reps > 0 ? Math.max(0, Math.min(1, 1 - Math.exp(-reps / 3))) : 0;
        const radius = Number(testRingProgressEl.getAttribute("r") || 46);
        const circumference = 2 * Math.PI * radius;
        testRingProgressEl.style.strokeDasharray = `${circumference.toFixed(2)} ${circumference.toFixed(2)}`;
        testRingProgressEl.style.strokeDashoffset = `${(circumference * (1 - progress)).toFixed(2)}`;
    }

    function normalizeFingerAnglesForBars(fingerAngles, fallbackMovement) {
        const fallback = Number.isFinite(Number(fallbackMovement)) ? Number(fallbackMovement) : 0;
        const source = fingerAngles && typeof fingerAngles === "object" ? fingerAngles : {};

        const mapValue = key => {
            const direct = Number(source[key]);
            if (Number.isFinite(direct)) {
                return Math.max(0, Math.min(90, direct));
            }
            return Math.max(0, Math.min(90, fallback));
        };

        return {
            thumb: mapValue("thumb"),
            index: mapValue("index"),
            middle: mapValue("middle"),
            ring: mapValue("ring"),
            pinky: mapValue("pinky")
        };
    }

    function updateTestFingerGauges(fingerAngles, fallbackMovement) {
        if (!testFingerGaugeCells.length) {
            return;
        }

        const normalized = normalizeFingerAnglesForBars(fingerAngles, fallbackMovement);

        testFingerGaugeCells.forEach(cell => {
            const key = String(cell.getAttribute("data-finger") || "").toLowerCase();
            const value = Number(normalized[key] ?? 0);
            const percent = Math.max(0, Math.min(100, (value / 90) * 100));
            const fill = cell.querySelector(".test-gauge-fill");
            const label = cell.querySelector(".test-gauge-value");

            if (fill instanceof HTMLElement) {
                fill.style.height = `${percent.toFixed(1)}%`;
            }
            if (label instanceof HTMLElement) {
                label.textContent = `${value.toFixed(1)}°`;
            }
        });
    }

    function canAccessStep(stepNumber) {
        if (stepNumber <= 1) return true;
        if (stepNumber === 2) return gloveConnected;
        if (stepNumber === 3) return gloveConnected && calibrationComplete;
        if (stepNumber === 4) return gloveConnected && calibrationComplete && testCompleted;
        if (stepNumber === 5) return gloveConnected && calibrationComplete && sessionPrepared;
        return false;
    }

    function updateStepNavigationState() {
        navDots.forEach((dot, index) => {
            if (!dot) return;
            const step = index + 1;
            const accessible = canAccessStep(step);
            dot.disabled = !accessible;
            dot.classList.toggle("is-disabled", !accessible);
        });

        if (backStepBtn) {
            backStepBtn.disabled = currentStep <= 1;
            backStepBtn.hidden = currentStep === 1;
        }

        if (nextStepBtn) {
            const hasNextStep = currentStep < 5;
            nextStepBtn.hidden = !hasNextStep;
            nextStepBtn.textContent = "Next";
            nextStepBtn.setAttribute("aria-label", "Go to next step");
            nextStepBtn.disabled = currentStep === 4 ? !selectedExercise : (!hasNextStep || !canAccessStep(currentStep + 1));
            nextStepBtn.classList.remove("is-confirmed");
        }

        if (retryStepBtn) {
            retryStepBtn.hidden = !(currentStep === 2 && calibrationComplete);
            retryStepBtn.disabled = false;
        }
    }

    function attemptStep(stepNumber) {
        if (!canAccessStep(stepNumber)) {
            if (stepNumber === 2) {
                setMsg(searchingLabel, "Glove not connected. Refresh glove status to continue.");
            } else if (stepNumber === 3) {
                setMsg(calibrationStatus, "Complete calibration first to continue.");
            } else if (stepNumber === 4) {
                setMsg(testStatus, "Complete the testing stage first.");
            } else if (stepNumber === 5) {
                setMsg(diagStatus, "Confirm the selected exercise in Step 4 to continue.");
            }
            return;
        }
        goToStep(stepNumber);
    }

    function goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 5) {
            return;
        }

        if (currentStep === 3 && stepNumber !== 3 && testState.isRunning) {
            if (testState.intervalId) {
                clearInterval(testState.intervalId);
                testState.intervalId = null;
            }
            testState.isRunning = false;
            if (startTestBtn) startTestBtn.disabled = false;
            if (stopTestBtn) stopTestBtn.disabled = true;
        }

        currentStep = stepNumber;

        if (stepperViewport) {
            stepperViewport.classList.add("is-switching");
            setTimeout(() => stepperViewport?.classList.remove("is-switching"), 300);
        }

        stepPanels.forEach((panel, i) => {
            if (!panel) return;
            panel.hidden = i + 1 !== stepNumber;
            panel.classList.toggle("is-active", i + 1 === stepNumber);
            panel.classList.toggle("is-done", i + 1 < stepNumber);
            panel.classList.toggle("is-locked", i + 1 > stepNumber);
        });

        root.classList.toggle("is-focus-mode", stepNumber === 5);

        // Update nav dots
        navDots.forEach((dot, i) => {
            if (!dot) return;
            dot.classList.toggle("is-active", i + 1 === stepNumber);
            dot.classList.toggle("is-done", i + 1 < stepNumber);
        });

        updateStepNavigationState();
    }

    // ── STEP 1: Connect ───────────────────────────────────────────────────────
    pairButton?.addEventListener("click", async () => {
        pairButton.disabled = true;
        setMsg(searchingLabel, "Searching for Glove...");
        if (searchingAnim) searchingAnim.classList.add("is-searching");
        if (searchingAnim) searchingAnim.classList.remove("is-connected");

        await refreshGloveConnectionState({ showStatus: true });

        pairButton.disabled = false;
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

    function announceGloveOffline() {
        try {
            const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
            gloveData.connected = false;
            gloveData.sessionActive = false;
            gloveData.lastOfflineAt = Date.now();
            localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
        } catch { /* storage may be blocked in private-browsing mode */ }
    }

    // ── STEP 2: Calibrate ─────────────────────────────────────────────────────
    function renderCalibrationGrid() {
        if (!calibrationGrid) return;
        calibrationGrid.innerHTML = calibrationState.map(finger => {
            const zeroLocked = finger.zero !== null;
            const maxLocked = finger.max !== null;
            const currentDeg = Number(finger.current || 0);
            return `<div class="calibration-finger ${zeroLocked && maxLocked ? "is-locked" : ""}">
                <strong>${finger.name}</strong>
                <span>Current: ${currentDeg.toFixed(1)}&deg;</span>
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

    function resetCalibrationFlow() {
        stopCalibrationPolling();
        calibrationState.forEach(finger => {
            finger.zero = null;
            finger.max = null;
            finger.current = 0;
        });

        calibrationPhase = "zero";
        calibrationComplete = false;
        calibrationRequested = false;
        syncCalibrationButtonState();
        testCompleted = false;
        sessionPrepared = false;
        diagResults.maxFlexion = 0;
        diagResults.maxExtension = 0;

        if (testState.intervalId) {
            clearInterval(testState.intervalId);
            testState.intervalId = null;
        }
        testState.isRunning = false;
        testState.reps = 0;
        testState.totalForce = 0;
        testState.sampleCount = 0;
        testState.startTime = null;
        testState.motionPhase = "";
        testState.lastReadingId = 0;
        testState.lastReadingAt = "";
        testState.lastReadingTs = 0;

        if (calibrateBtn) {
            calibrateBtn.disabled = false;
        }
        if (startTestBtn) startTestBtn.disabled = false;
        if (stopTestBtn) stopTestBtn.disabled = true;
        if (testRepsEl) testRepsEl.textContent = "0";
        if (testMovementEl) testMovementEl.textContent = "0.0°";
        if (testForceEl) testForceEl.textContent = "0.0 N";
        if (testTimeEl) testTimeEl.textContent = formatShotClock(TEST_SHOTCLOCK_SECONDS);
        if (testForceDialEl) {
            testForceDialEl.style.setProperty("--dial-angle", "-120deg");
        }
        updateTestProgressRing(0);
        setMsg(testStatus, "Ready to test glove data.");

        renderCalibrationGrid();
        updateCalibrationPrompt();
        setCalibrationProgress(0);
        setMsg(calibrationStatus, "0/5 fingers calibrated. Values cleared.");
        setMsg(diagStatus, "Calibration reset. Complete Step 2 again to continue.");
        goToStep(2);
        updateStepNavigationState();
    }

    calibrateBtn?.addEventListener("click", async () => {
        if (calibrationRequested || calibrationPollTimer !== null || calibrationComplete) {
            return;
        }

        calibrateBtn.disabled = true;

        try {
            const payload = await requestGloveCalibration();
            calibrationRequested = true;
            calibrationComplete = false;
            syncCalibrationButtonState();
            calibrationRequestedAt = Date.now();
            setCalibrationProgress(0);
            setMsg(calibrationStatus, `Calibration request sent to the glove (command #${payload.command_id}). Waiting for completion...`);
            stopCalibrationPolling();
            calibrationPollTimer = window.setInterval(() => {
                void pollCalibrationUntilComplete();
            }, 1000);
            void pollCalibrationUntilComplete();
        } catch (err) {
            calibrationRequested = false;
            calibrationComplete = false;
            syncCalibrationButtonState();
            setMsg(calibrationStatus, err instanceof Error ? err.message : "Unable to request calibration.");
        }
    });

    retryStepBtn?.addEventListener("click", () => {
        resetCalibrationFlow();
    });

    startTestBtn?.addEventListener("click", async () => {
        if (testState.isRunning) return;

        testCompleted = false;
        testState.isRunning = true;
        testState.reps = 0;
        testState.totalForce = 0;
        testState.sampleCount = 0;
        testState.bestFlexion = 0;
        testState.peakForce = 0;
        testState.startTime = Date.now();
        testState.motionPhase = "";
        testState.lastReadingId = 0;
        testState.lastReadingAt = "";
        testState.lastReadingTs = 0;

        if (testRepsEl) testRepsEl.textContent = "0";
        if (testMovementEl) testMovementEl.textContent = "0.0°";
        if (testForceEl) testForceEl.textContent = "0.0 N";
        if (testTimeEl) testTimeEl.textContent = formatShotClock(TEST_SHOTCLOCK_SECONDS);
        updateTestProgressRing(0);

        startTestBtn.disabled = true;
        if (stopTestBtn) stopTestBtn.disabled = false;
        setMsg(testStatus, "Testing stage running — glove is streaming live data…");

        try {
            await requestGloveCommand("start_session");
            setMsg(testStatus, "Testing stage started on glove. Move your hand to stream live data.");
        } catch (err) {
            testState.isRunning = false;
            startTestBtn.disabled = false;
            if (stopTestBtn) stopTestBtn.disabled = true;
            setMsg(testStatus, err instanceof Error ? err.message : "Unable to start glove test stream.");
            return;
        }

        testState.intervalId = setInterval(async () => {
            let reading = null;
            try {
                reading = await fetchLatestGloveReading();
            } catch (err) {
                setMsg(testStatus, err instanceof Error ? err.message : "Unable to read glove data.");
                return;
            }

            if (!reading) {
                setMsg(testStatus, "Waiting for real glove data...");
                return;
            }

            const recordedAt = reading.recordedAt;
            if ((reading.id > 0 && reading.id === testState.lastReadingId) || (!reading.id && recordedAt && recordedAt === testState.lastReadingAt)) {
                setMsg(testStatus, "No new glove sample yet. Keep moving your hand.");
                return;
            }

            const currentTs = Date.parse(recordedAt);
            testState.lastReadingId = Number(reading.id || 0);
            testState.lastReadingAt = recordedAt;
            testState.lastReadingTs = Number.isFinite(currentTs) ? currentTs : Date.now();

            const force = reading.force;
            const movement = reading.movement;
            const movementState = classifyLiveMovement(movement, reading.calibrationProfile);
            const nextPhase = movementState.phase === "open" ? "open" : movementState.phase === "close" ? "close" : "";
            if (nextPhase === "close" && testState.motionPhase === "open") {
                testState.reps += 1;
                testState.motionPhase = "close";
            } else if (nextPhase === "open" && testState.motionPhase !== "open") {
                testState.motionPhase = "open";
            } else if (testState.motionPhase === "" && nextPhase !== "") {
                testState.motionPhase = nextPhase;
            }

            testState.totalForce += force;
            testState.sampleCount += 1;
            testState.bestFlexion = Math.max(testState.bestFlexion, displayedMovement);
            testState.peakForce = Math.max(testState.peakForce, force);

            const avgForce = testState.totalForce / testState.sampleCount;
            const elapsed = testState.startTime ? Math.floor((Date.now() - testState.startTime) / 1000) : 0;
            const remaining = Math.max(0, TEST_SHOTCLOCK_SECONDS - elapsed);
            const movementLabel = movementState.phase === "open" ? "OPEN" : movementState.phase === "close" ? "CLOSED" : "MID";
            const displayedMovement = movementState.phase === "middle" ? movement : movementState.normalizedDeg;
            updateTestFingerGauges(reading.fingerAngles, displayedMovement);

            if (testRepsEl) testRepsEl.textContent = String(testState.reps);
            if (testMovementEl) testMovementEl.textContent = `${movementLabel} ${displayedMovement.toFixed(1)}°`;
            if (testForceEl) testForceEl.textContent = `${avgForce.toFixed(1)} N`;
            if (testTimeEl) testTimeEl.textContent = formatShotClock(remaining);
            if (testForceDialEl) {
                const cappedForce = Math.max(0, Math.min(60, Number(avgForce) || 0));
                const dialAngle = -120 + ((cappedForce / 60) * 240);
                testForceDialEl.style.setProperty("--dial-angle", `${dialAngle.toFixed(1)}deg`);
            }
            updateTestProgressRing(testState.reps);
            setMsg(testStatus, `Live capture: ${movementLabel.toLowerCase()} hand (${displayedMovement.toFixed(1)}°). Keep moving your hand.`);

            try {
                const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
                gloveData.sessionMovementDeg = Number(displayedMovement.toFixed(1));
                gloveData.lastMovementDeg = Number(displayedMovement.toFixed(1));
                gloveData.livePhase = movementState.phase;
                gloveData.sessionForce = avgForce.toFixed(1);
                localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
            } catch { /* storage may be blocked */ }

            if (!testCompleted && testState.sampleCount > 0) {
                testCompleted = true;
                updateStepNavigationState();
            }

            if (remaining <= 0) {
                if (testState.intervalId) {
                    clearInterval(testState.intervalId);
                    testState.intervalId = null;
                }
                testState.isRunning = false;
                if (startTestBtn) startTestBtn.disabled = false;
                if (stopTestBtn) stopTestBtn.disabled = true;

                try {
                    await requestGloveCommand("stop_session");
                } catch {
                    // Keep UI responsive even if glove acknowledgment is delayed.
                }

                if (testCompleted) {
                    setMsg(testStatus, "30-second test complete. Continue to Step 4.");
                } else {
                    setMsg(testStatus, "30-second test complete, but no valid sample was captured. Start test again.");
                }
            }
        }, 1000);
    });

    stopTestBtn?.addEventListener("click", async () => {
        if (testState.intervalId) {
            clearInterval(testState.intervalId);
            testState.intervalId = null;
        }
        testState.isRunning = false;
        if (startTestBtn) startTestBtn.disabled = false;
        stopTestBtn.disabled = true;

        try {
            await requestGloveCommand("stop_session");
        } catch {
            // Keep UI responsive even if command acknowledgment is delayed.
        }

        if (testCompleted) {
            const avgForce = testState.sampleCount > 0 ? testState.totalForce / testState.sampleCount : 0;
            const bestPeakForce = Math.max(avgForce, testState.peakForce);

            try {
                const response = await fetch("api/patient/diagnostic_logs.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stageName: defaultAssessmentStageName,
                        maxExtension: 0,
                        maxFlexion: testState.bestFlexion,
                        peakForce: bestPeakForce
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload?.ok) {
                    throw new Error(payload?.error || "Unable to save testing metrics.");
                }
                setMsg(testStatus, "Testing saved as assessment. Continue to Step 4.");
            } catch (error) {
                setMsg(testStatus, error instanceof Error ? error.message : "Testing completed, but saving failed.");
            }
        } else {
            setMsg(testStatus, "No valid sample captured yet. Start test again.");
        }
    });

    renderCalibrationGrid();
    void loadPatientContext();
    void refreshGloveConnectionState();
    setMsg(searchingLabel, "Searching for Glove...");
    if (searchingAnim) searchingAnim.classList.add("is-searching");
    setInterval(() => {
        void refreshGloveConnectionState();
    }, 5000);
    updateTestProgressRing(0);

    // ── STEP 4: Select Exercise (Therapy Mode) ──────────────────────────────
    function updateExerciseOptionsVisibility() {
        if (!selectedExercise) {
            if (speedWrap) speedWrap.hidden = true;
            if (holdWrap) holdWrap.hidden = true;
            return;
        }

        const hold = isHoldExercise(selectedExercise);
        if (speedWrap) speedWrap.hidden = hold;
        if (holdWrap) holdWrap.hidden = !hold;
    }

    function renderExerciseSelection() {
        exerciseConfirmed = false;
        exerciseCards.forEach(card => {
            const type = String(card.getAttribute("data-exercise-type") || "");
            card.classList.toggle("is-selected", type === selectedExercise);
            card.setAttribute("aria-checked", String(type === selectedExercise));
        });

        speedButtons.forEach(btn => {
            const speed = String(btn.getAttribute("data-speed") || "");
            btn.classList.toggle("is-selected", speed === selectedSpeed);
            btn.setAttribute("aria-pressed", String(speed === selectedSpeed));
        });

        holdButtons.forEach(btn => {
            const seconds = Number(btn.getAttribute("data-hold-seconds") || 0);
            const selected = seconds === selectedHoldSeconds;
            btn.classList.toggle("is-selected", selected);
            btn.setAttribute("aria-pressed", String(selected));
        });

        updateExerciseOptionsVisibility();
        updateStepNavigationState();
    }

    function applyTherapyPlan(plan) {
        planDurationMin = Number(plan.duration_min || plan.durationMin || 15);
        planTargetReps = Number(plan.target_repetitions || plan.targetRepetitions || 120);

        if (therapyDurationEl) therapyDurationEl.textContent = `${planDurationMin} min`;
        if (therapyRepsEl) therapyRepsEl.textContent = `${planTargetReps} reps`;
        if (targetRepsEl) targetRepsEl.textContent = String(planTargetReps);

        sessionState.targetRepetitions = planTargetReps;
        updateSessionProgressRing(sessionState.reps);
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
                setMsg(diagStatus, "Plan ready. Select an exercise to continue.");
            })
            .catch(() => {
                applyTherapyPlan({ duration_min: 15, target_repetitions: 120 });
                setMsg(diagStatus, "Plan unavailable. Using default targets.");
            });
    }

    function describeSelection() {
        const exerciseLabel = exerciseLabelMap[selectedExercise] || "Exercise";
        if (isHoldExercise(selectedExercise)) {
            return `${exerciseLabel} selected. Hold for ${selectedHoldSeconds}s per repetition.`;
        }
        return `${exerciseLabel} selected at ${selectedSpeed} speed.`;
    }

    function refreshSessionSummary() {
        const exerciseLabel = exerciseLabelMap[selectedExercise] || "—";
        if (sessionExerciseEl) sessionExerciseEl.textContent = exerciseLabel;
        if (targetRepsEl) targetRepsEl.textContent = String(planTargetReps);

        if (sessionIntro) {
            if (isHoldExercise(selectedExercise)) {
                sessionIntro.textContent = `${exerciseLabel} selected. Hold each repetition for ${selectedHoldSeconds} seconds, then count the rep.`;
            } else {
                sessionIntro.textContent = `${exerciseLabel} selected at ${selectedSpeed} speed. Perform correct movements to count repetitions.`;
            }
        }

        if (sessionTimeEl) {
            sessionTimeEl.textContent = isHoldExercise(selectedExercise)
                ? `0s / ${selectedHoldSeconds}s`
                : "0:00";
        }
        updateSessionProgressRing(sessionState.reps);
    }

    exerciseCards.forEach(card => {
        card.addEventListener("click", () => {
            selectedExercise = String(card.getAttribute("data-exercise-type") || "");
            renderExerciseSelection();
            setMsg(diagStatus, describeSelection());
        });
    });

    speedButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            selectedSpeed = String(btn.getAttribute("data-speed") || "normal");
            renderExerciseSelection();
            if (selectedExercise && !isHoldExercise(selectedExercise)) {
                setMsg(diagStatus, describeSelection());
            }
        });
    });

    holdButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            selectedHoldSeconds = Math.max(1, Number(btn.getAttribute("data-hold-seconds") || 5));
            renderExerciseSelection();
            if (selectedExercise && isHoldExercise(selectedExercise)) {
                setMsg(diagStatus, describeSelection());
            }
        });
    });

    function confirmSelectedExercise() {
        if (!calibrationComplete) {
            setMsg(diagStatus, "Complete calibration before selecting an exercise.");
            return;
        }
        if (!selectedExercise) {
            setMsg(diagStatus, "Select an exercise type to continue.");
            return;
        }

        refreshSessionSummary();
        sessionPrepared = true;
        exerciseConfirmed = true;
        updateStepNavigationState();
        if (nextStepBtn) {
            nextStepBtn.textContent = "Next";
            nextStepBtn.setAttribute("aria-label", "Go to next step");
        }
        goToStep(5);
        setMsg(sessionStatus, "");

        void requestGloveCommand("start_session").then(() => {
            setMsg(sessionStatus, "Session start sent to the glove.");
        }).catch(err => {
            setMsg(sessionStatus, err instanceof Error ? err.message : "Unable to start glove session.");
        });
    }

    navDots.forEach((dot, index) => {
        dot?.addEventListener("click", () => {
            attemptStep(index + 1);
        });
    });

    backStepBtn?.addEventListener("click", () => {
        attemptStep(Math.max(1, currentStep - 1));
    });

    nextStepBtn?.addEventListener("click", () => {
        if (currentStep === 4) {
            confirmSelectedExercise();
            return;
        }

        attemptStep(Math.min(5, currentStep + 1));
    });

    // ── STEP 5: Session ───────────────────────────────────────────────────────
    startSessionBtn?.addEventListener("click", () => {
        if (!selectedExercise) {
            setMsg(sessionStatus, "Select an exercise first in Step 4.");
            return;
        }
        if (sessionState.isRunning) return;

        sessionState.isRunning = true;
        sessionState.startTime = Date.now();
        sessionState.reps = 0;
        sessionState.totalForce = 0;
        sessionState.sampleCount = 0;
        sessionState.holdProgressSeconds = 0;
        sessionState.motionPhase = "";
        sessionState.lastReadingId = 0;
        sessionState.lastReadingAt = "";
        sessionState.lastReadingTs = 0;

        if (sessionRepsEl) sessionRepsEl.textContent = "0";
        if (sessionMovementEl) sessionMovementEl.textContent = "0.0°";
        if (sessionForceEl) sessionForceEl.textContent = "0.0 N";
        updateSessionProgressRing(0);

        startSessionBtn.disabled = true;
        if (endSessionBtn) endSessionBtn.disabled = false;
        setMsg(sessionStatus, "Session running — glove is streaming live data…");

        const OPEN_THRESHOLD_DEG = 10;
        const CLOSE_THRESHOLD_DEG = 80;

        sessionState.intervalId = setInterval(async () => {
            let reading = null;
            try {
                reading = await fetchLatestGloveReading();
            } catch (err) {
                setMsg(sessionStatus, err instanceof Error ? err.message : "Unable to read glove data.");
                return;
            }

            if (!reading) {
                setMsg(sessionStatus, "Waiting for real glove data...");
                return;
            }

            const recordedAt = reading.recordedAt;
            if ((reading.id > 0 && reading.id === sessionState.lastReadingId) || (!reading.id && recordedAt && recordedAt === sessionState.lastReadingAt)) {
                setMsg(sessionStatus, "No new glove sample yet. Keep moving your hand.");
                return;
            }

            const currentTs = Date.parse(recordedAt);
            const deltaSeconds = sessionState.lastReadingTs > 0 && Number.isFinite(currentTs)
                ? Math.max(0.2, Math.min(3, (currentTs - sessionState.lastReadingTs) / 1000))
                : 1;

            sessionState.lastReadingId = Number(reading.id || 0);
            sessionState.lastReadingAt = recordedAt;
            sessionState.lastReadingTs = Number.isFinite(currentTs) ? currentTs : Date.now();

            const force = reading.force;
            const movement = reading.movement;

            if (sessionMovementEl) {
                sessionMovementEl.textContent = `${movement.toFixed(1)}°`;
            }

            if (isHoldExercise(selectedExercise)) {
                const maintained = selectedExercise === "full_grip_hold"
                    ? movement >= CLOSE_THRESHOLD_DEG
                    : movement <= OPEN_THRESHOLD_DEG;

                if (maintained) {
                    sessionState.holdProgressSeconds += deltaSeconds;
                    if (sessionState.holdProgressSeconds >= selectedHoldSeconds) {
                        sessionState.reps += 1;
                        sessionState.holdProgressSeconds = 0;
                        setMsg(sessionStatus, "Hold repetition validated and counted.");
                    }
                } else {
                    sessionState.holdProgressSeconds = 0;
                }
            } else {
                const nextPhase = movement <= OPEN_THRESHOLD_DEG ? "open" : movement >= CLOSE_THRESHOLD_DEG ? "close" : "";
                if (nextPhase === "close" && sessionState.motionPhase === "open") {
                    sessionState.reps += 1;
                    sessionState.motionPhase = "close";
                } else if (nextPhase === "open" && sessionState.motionPhase !== "open") {
                    sessionState.motionPhase = "open";
                } else if (sessionState.motionPhase === "" && nextPhase !== "") {
                    sessionState.motionPhase = nextPhase;
                }
            }

            sessionState.totalForce  += force;
            sessionState.sampleCount += 1;
            diagResults.maxFlexion = Math.max(Number(diagResults.maxFlexion || 0), movement);
            diagResults.peakForce = Math.max(Number(diagResults.peakForce || 0), force);

            const avgForce = sessionState.totalForce / sessionState.sampleCount;
            const elapsed  = Math.floor((Date.now() - sessionState.startTime) / 1000);
            const mm = Math.floor(elapsed / 60);
            const ss = String(elapsed % 60).padStart(2, "0");

            if (sessionRepsEl)  sessionRepsEl.textContent  = String(sessionState.reps);
            if (sessionForceEl) sessionForceEl.textContent = `${avgForce.toFixed(1)} N`;
            updateSessionProgressRing(sessionState.reps);
            if (sessionTimeEl) {
                sessionTimeEl.textContent = isHoldExercise(selectedExercise)
                    ? `${sessionState.holdProgressSeconds}s / ${selectedHoldSeconds}s`
                    : `${mm}:${ss}`;
            }

            // Broadcast live metrics to Home dashboard via localStorage
            try {
                const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
                gloveData.sessionReps   = sessionState.reps;
                gloveData.sessionForce  = avgForce.toFixed(1);
                gloveData.sessionMovementDeg = Number(movement.toFixed(1));
                gloveData.lastMovementDeg = Number(movement.toFixed(1));
                gloveData.sessionActive = true;
                gloveData.targetRepetitions = sessionState.targetRepetitions;
                gloveData.exerciseType = selectedExercise;
                localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
            } catch { /* storage may be blocked */ }
        }, 1000);
    });

    endSessionBtn?.addEventListener("click", async () => {
        if (!sessionState.isRunning) return;
        clearInterval(sessionState.intervalId);
        sessionState.isRunning = false;
        if (endSessionBtn) endSessionBtn.disabled = true;
        setMsg(sessionStatus, "Saving session…");

        try {
            await requestGloveCommand("stop_session");
        } catch (err) {
            setMsg(sessionStatus, err instanceof Error ? err.message : "Unable to stop glove session.");
        }

        const avgForce = sessionState.sampleCount > 0
            ? sessionState.totalForce / sessionState.sampleCount
            : diagResults.peakForce;
        const sessionResult = sessionState.reps >= sessionState.targetRepetitions ? "Success" : "Needs Work";
        const durationSeconds = sessionState.startTime
            ? Math.max(0, Math.floor((Date.now() - sessionState.startTime) / 1000))
            : 0;

        try {
            const res = await fetch("api/patient/exercise_session.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    peakForce: avgForce,
                    maxFlexion: diagResults.maxFlexion,
                    maxExtension: diagResults.maxExtension,
                    repetitions: sessionState.reps,
                    durationSec: durationSeconds,
                    status: sessionResult,
                    exerciseType: selectedExercise,
                    speed: isHoldExercise(selectedExercise) ? null : selectedSpeed,
                    holdDurationSec: isHoldExercise(selectedExercise) ? selectedHoldSeconds : null
                })
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.ok) throw new Error(payload?.error || "Save failed");
            setMsg(sessionStatus, `Session saved (${sessionResult}) — great work!`);
            try {
                const gloveData = JSON.parse(localStorage.getItem("theraflow_glove") || "{}");
                gloveData.sessionActive = false;
                gloveData.targetRepetitions = sessionState.targetRepetitions;
                gloveData.exerciseType = selectedExercise;
                localStorage.setItem("theraflow_glove", JSON.stringify(gloveData));
            } catch { /* storage may be blocked */ }
            startSessionBtn.disabled = false;
            openSessionSummaryModal({
                result: sessionResult,
                exerciseLabel: exerciseLabelMap[selectedExercise] || selectedExercise || "-",
                repetitions: sessionState.reps,
                target: sessionState.targetRepetitions,
                avgForce,
                maxFlexion: diagResults.maxFlexion,
                durationSeconds
            });
        } catch (err) {
            setMsg(sessionStatus, err instanceof Error ? err.message : "Failed to save session.");
            if (endSessionBtn) endSessionBtn.disabled = false;
        }
    });

    summaryDoneBtn?.addEventListener("click", finalizeSessionSummaryAndReset);
    summaryCloseBtn?.addEventListener("click", finalizeSessionSummaryAndReset);

    // Prefetch plan target from server
    loadTherapyPlan();
    renderExerciseSelection();
    updateStepNavigationState();

    goToStep(1);
}

function initializeRecoveryPage() {
    const root = document.getElementById("recoveryRoot");
    if (!root) {
        return;
    }

    const recentList = document.getElementById("recoveryRecentList");
    const allSessionsList = document.getElementById("recoveryAllSessionsList");
    const viewAllBtn = document.getElementById("recoveryViewAllBtn");
    const sessionsModal = document.getElementById("recoverySessionsModal");
    const sessionsBackdrop = document.getElementById("recoverySessionsBackdrop");
    const sessionsCloseBtn = document.getElementById("recoverySessionsClose");
    const bestSessionsListEl = document.getElementById("recoveryBestSessionsList");
    const forceCanvas = document.getElementById("recoveryForceChart");
    const romCanvas = document.getElementById("recoveryRomChart");
    const forceChartWrap = document.getElementById("recoveryForceChartWrap");
    const romChartWrap = document.getElementById("recoveryRomChartWrap");
    const forceEmptyEl = document.getElementById("recoveryForceChartEmpty");
    const romEmptyEl = document.getElementById("recoveryRomChartEmpty");
    const forceBestOutsideEl = document.getElementById("recoveryForceBestOutside");
    const romBestOutsideEl = document.getElementById("recoveryRomBestOutside");

    const forceToggleButtons = Array.from(document.querySelectorAll("#recoveryForceViewToggle [data-view]"));
    const forceShowValuesToggle = document.getElementById("recoveryForceShowValues");
    const forceNav = document.getElementById("recoveryForceNav");
    const forcePrevBtn = document.getElementById("recoveryForcePrev");
    const forceNextBtn = document.getElementById("recoveryForceNext");
    const forceRangeLabel = document.getElementById("recoveryForceRangeLabel");

    const romToggleButtons = Array.from(document.querySelectorAll("#recoveryRomViewToggle [data-view]"));
    const romShowValuesToggle = document.getElementById("recoveryRomShowValues");
    const romNav = document.getElementById("recoveryRomNav");
    const romPrevBtn = document.getElementById("recoveryRomPrev");
    const romNextBtn = document.getElementById("recoveryRomNext");
    const romRangeLabel = document.getElementById("recoveryRomRangeLabel");

    const totalSessionsEl = document.getElementById("recoveryTotalSessions");

    let forceChart = null;
    let romChart = null;
    const forceViewState = {
        view: "recent",
        weekOffset: 0,
        monthOffset: 0,
        showValues: forceShowValuesToggle ? Boolean(forceShowValuesToggle.checked) : false
    };
    const romViewState = {
        view: "recent",
        weekOffset: 0,
        monthOffset: 0,
        showValues: romShowValuesToggle ? Boolean(romShowValuesToggle.checked) : false
    };
    let recoveryDataReady = false;

    let logs = [];

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
        if (/great|success/i.test(rawStatus)) {
            return { label: "Great Job", className: "is-great" };
        }
        if (/improv|stable/i.test(rawStatus)) {
            return { label: "Improving", className: "is-stable" };
        }
        return { label: "Needs Work", className: "is-needs-work" };
    }

    function formatShortMonthDay(value) {
        return value.toLocaleDateString([], { month: "short", day: "2-digit" });
    }

    function formatMonthYear(value) {
        return value.toLocaleDateString([], { month: "short", year: "numeric" });
    }

    function getLogsAscending() {
        return [...logs]
            .map(log => ({
                ...log,
                __time: new Date(String(log.timestamp || ""))
            }))
            .filter(log => !Number.isNaN(log.__time.getTime()))
            .sort((a, b) => a.__time.getTime() - b.__time.getTime());
    }

    function getMetricValue(log, metricKey) {
        if (metricKey === "force") {
            return Number(log.grip_strength || 0);
        }
        return Number(log.finger_movement || log.flexion_angle || 0);
    }

    function applyRecoveryChartDefaults() {
        if (typeof Chart === "undefined" || window.__theraflowRecoveryChartDefaultsApplied) {
            return;
        }

        Chart.defaults.font.family = '"Poppins", "Segoe UI", sans-serif';
        Chart.defaults.font.size = 12;
        Chart.defaults.color = "#5e7681";
        window.__theraflowRecoveryChartDefaultsApplied = true;
    }

    function getPeakIndex(data) {
        if (!Array.isArray(data) || !data.length) {
            return -1;
        }

        let peakIndex = 0;
        let peakValue = Number(data[0] || 0);
        for (let i = 1; i < data.length; i += 1) {
            const value = Number(data[i] || 0);
            if (value > peakValue) {
                peakValue = value;
                peakIndex = i;
            }
        }

        return peakIndex;
    }

    function renderTrendChart(canvas, chartRef, label, labels, data, options = {}) {
        if (!canvas || typeof Chart === "undefined") {
            return chartRef;
        }

        applyRecoveryChartDefaults();

        if (chartRef) {
            chartRef.destroy();
        }

        const chartType = String(options.chartType || "line");
        const themeColor = String(options.lineColor || "#4d869c");
        const drawArea = options.fillArea !== false;
        const lineTension = Number.isFinite(Number(options.tension)) ? Number(options.tension) : 0.35;
        const pointRadius = Number.isFinite(Number(options.pointRadius)) ? Number(options.pointRadius) : 4;
        const pointHoverRadius = Number.isFinite(Number(options.pointHoverRadius)) ? Number(options.pointHoverRadius) : 6;
        const pointBackgroundColor = String(options.pointBackgroundColor || themeColor);
        const pointBorderColor = String(options.pointBorderColor || "#ffffff");
        const pointBorderWidth = Number.isFinite(Number(options.pointBorderWidth)) ? Number(options.pointBorderWidth) : 2;
        const unit = String(options.unit || "");
        const isCompact = window.matchMedia("(max-width: 880px)").matches;
        const maxRotation = chartType === "bar" && isCompact ? 45 : 0;
        const pointLabelFont = '700 13px "Poppins", "Segoe UI", sans-serif';

        const peakIndex = getPeakIndex(data);
        const peakValue = peakIndex >= 0 ? Number(data[peakIndex] || 0) : 0;

        const peakMarkerPlugin = {
            id: `${canvas.id}-peakMarker`,
            afterDatasetsDraw(chart) {
                if (peakIndex < 0 || !options.peakLabelPrefix || options.showPeakLabel === false) {
                    return;
                }

                const ctx = chart.ctx;
                const points = chart.getDatasetMeta(0)?.data || [];
                const peakPoint = points[peakIndex];
                if (!peakPoint) {
                    return;
                }

                const labelText = `${options.peakLabelPrefix}: ${peakValue.toFixed(1)}${unit}`;

                ctx.save();
                ctx.fillStyle = "#1f5668";
                ctx.font = "700 12px Poppins";
                ctx.textAlign = "left";
                ctx.textBaseline = "bottom";
                ctx.fillText(labelText, peakPoint.x + 10, peakPoint.y - 8);
                ctx.restore();
            }
        };

        const valueLabelPlugin = {
            id: `${canvas.id}-valueLabel`,
            afterDatasetsDraw(chart) {
                if (options.showPointLabels === false) {
                    return;
                }

                const ctx = chart.ctx;
                const points = chart.getDatasetMeta(0)?.data || [];
                if (!points.length) {
                    return;
                }

                ctx.save();
                ctx.fillStyle = "#4b5563";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.font = pointLabelFont;

                points.forEach((point, index) => {
                    const raw = Number(data[index] || 0);
                    const text = `${Number.isInteger(raw) ? raw : raw.toFixed(1)}`;
                    ctx.fillText(text, point.x, point.y - 10);
                });

                ctx.restore();
            }
        };

        const areaFill = context => {
            const chart = context.chart;
            const chartArea = chart.chartArea;
            if (!chartArea) {
                return "rgba(77, 134, 156, 0.2)";
            }

            const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(77, 134, 156, 0.38)");
            gradient.addColorStop(1, "rgba(77, 134, 156, 0.0)");
            return gradient;
        };

        const datasets = chartType === "bar"
            ? [{
                label,
                data,
                backgroundColor: "rgba(77, 134, 156, 0.9)",
                borderColor: themeColor,
                borderWidth: 1.2,
                borderRadius: 8,
                maxBarThickness: 26
            }]
            : [{
                label,
                data,
                borderColor: themeColor,
                backgroundColor: drawArea ? areaFill : "transparent",
                fill: drawArea,
                borderWidth: 2.4,
                tension: lineTension,
                pointRadius: context => (context.dataIndex === peakIndex ? pointRadius + 2 : pointRadius),
                pointHoverRadius: context => (context.dataIndex === peakIndex ? pointHoverRadius + 2 : pointHoverRadius),
                pointBackgroundColor,
                pointBorderColor,
                pointBorderWidth
            }];

        return new Chart(canvas, {
            type: chartType,
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        right: 48,
                        top: 10,
                        bottom: 6
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: "#f0f4f5"
                        },
                        ticks: {
                            color: "#5e7681",
                            autoSkip: chartType === "bar" && isCompact,
                            maxRotation,
                            minRotation: maxRotation,
                            callback(value, index) {
                                if (chartType !== "bar" || !isCompact) {
                                    return this.getLabelForValue(value);
                                }

                                return index % 3 === 0 ? this.getLabelForValue(value) : "";
                            },
                            font: {
                                size: 13
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: "#f0f4f5"
                        },
                        ticks: {
                            color: "#5e7681",
                            font: {
                                size: 13
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: options.showLegend !== false,
                        labels: {
                            boxWidth: 18,
                            boxHeight: 2,
                            usePointStyle: false,
                            color: "#4d6a76"
                        }
                    },
                    tooltip: {
                        backgroundColor: "#ffffff",
                        borderColor: "#4d869c",
                        borderWidth: 1,
                        titleColor: "#1f5668",
                        bodyColor: "#1f5668",
                        cornerRadius: 12,
                        titleFont: {
                            weight: "700"
                        },
                        bodyFont: {
                            weight: "700"
                        },
                        callbacks: {
                            label(context) {
                                const raw = Number(context.raw || 0);
                                const value = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
                                return `${value}${unit}`;
                            }
                        }
                    }
                }
            },
            plugins: [peakMarkerPlugin, valueLabelPlugin]
        });
    }

    function buildRecentSeries(metricKey) {
        const source = logs.slice(0, 7).reverse();
        const labels = source.map((_, index) => `S${index + 1}`);
        const values = source.map(log => getMetricValue(log, metricKey));
        return {
            labels,
            values,
            noData: source.length === 0,
            chartType: "line"
        };
    }

    function buildDailySeries(metricKey, weekOffset) {
        const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const today = new Date();
        const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (weekOffset * 7));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const sums = new Array(7).fill(0);
        const counts = new Array(7).fill(0);

        getLogsAscending().forEach(log => {
            const time = log.__time;
            if (time < weekStart || time >= weekEnd) {
                return;
            }

            const idx = time.getDay();
            sums[idx] += getMetricValue(log, metricKey);
            counts[idx] += 1;
        });

        const values = dayLabels.map((_, idx) => counts[idx] > 0 ? Number((sums[idx] / counts[idx]).toFixed(2)) : 0);

        return {
            labels: dayLabels,
            values,
            noData: counts.every(count => count === 0),
            chartType: "line",
            rangeLabel: `${formatShortMonthDay(weekStart)} - ${formatShortMonthDay(new Date(weekEnd.getTime() - 86400000))}`
        };
    }

    function buildMonthlySeries(metricKey, monthOffset) {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

        const labels = [];
        const sums = new Array(daysInMonth).fill(0);
        const counts = new Array(daysInMonth).fill(0);

        for (let day = 1; day <= daysInMonth; day += 1) {
            labels.push(String(day));
        }

        getLogsAscending().forEach(log => {
            const time = log.__time;
            if (time < monthStart || time >= monthEnd) {
                return;
            }

            const index = time.getDate() - 1;
            sums[index] += getMetricValue(log, metricKey);
            counts[index] += 1;
        });

        const values = labels.map((_, idx) => counts[idx] > 0 ? Number((sums[idx] / counts[idx]).toFixed(2)) : 0);

        return {
            labels,
            values,
            noData: counts.every(count => count === 0),
            chartType: "bar",
            rangeLabel: formatMonthYear(monthStart)
        };
    }

    function buildSeries(metricKey, viewState) {
        if (viewState.view === "daily") {
            return buildDailySeries(metricKey, viewState.weekOffset);
        }
        if (viewState.view === "monthly") {
            return buildMonthlySeries(metricKey, viewState.monthOffset);
        }
        return buildRecentSeries(metricKey);
    }

    function setChartEmptyState(chartWrap, emptyEl, isEmpty) {
        if (!recoveryDataReady) {
            if (chartWrap) {
                chartWrap.classList.remove("is-empty");
            }
            if (emptyEl) {
                emptyEl.hidden = true;
            }
            return;
        }

        if (chartWrap) {
            chartWrap.classList.toggle("is-empty", Boolean(isEmpty));
        }
        if (emptyEl) {
            emptyEl.hidden = !isEmpty;
        }
    }

    function setActiveButtons(buttons, activeView) {
        const activeIndex = Math.max(0, buttons.findIndex(button => String(button.getAttribute("data-view") || "") === activeView));
        const segmented = buttons[0]?.closest(".recovery-segmented");
        if (segmented) {
            segmented.style.setProperty("--active-index", String(activeIndex));
        }

        buttons.forEach(button => {
            const isActive = String(button.getAttribute("data-view") || "") === activeView;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", String(isActive));
        });
    }

    function updateCardControls(viewState, buttons, navEl, labelEl, nextBtn, metricKey) {
        setActiveButtons(buttons, viewState.view);

        const navVisible = viewState.view === "daily" || viewState.view === "monthly";
        if (navEl) {
            navEl.hidden = !navVisible;
        }

        if (!navVisible) {
            return;
        }

        const info = buildSeries(metricKey, viewState);
        if (labelEl) {
            labelEl.textContent = String(info.rangeLabel || "");
        }

        if (nextBtn) {
            const offset = viewState.view === "daily" ? viewState.weekOffset : viewState.monthOffset;
            nextBtn.disabled = offset === 0;
        }
    }

    function renderForceTrend() {
        const series = buildSeries("force", forceViewState);
        const peak = series.values.reduce((maxValue, value) => Math.max(maxValue, Number(value || 0)), 0);

        if (forceBestOutsideEl) {
            forceBestOutsideEl.textContent = peak > 0 ? `Best: ${peak.toFixed(1)} N` : "Best: -- N";
        }

        setChartEmptyState(forceChartWrap, forceEmptyEl, series.noData);

        forceChart = renderTrendChart(forceCanvas, forceChart, "Force (N)", series.labels, series.values, {
            unit: " N",
            peakLabelPrefix: "Best",
            showPeakLabel: false,
            showPointLabels: !series.noData && forceViewState.showValues,
            chartType: series.chartType,
            fillArea: true,
            showLegend: true,
            lineColor: "#4d869c",
            pointBackgroundColor: "#4d869c",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.35
        });
    }

    function renderRomTrend() {
        const series = buildSeries("rom", romViewState);
        const peak = series.values.reduce((maxValue, value) => Math.max(maxValue, Number(value || 0)), 0);

        if (romBestOutsideEl) {
            romBestOutsideEl.textContent = peak > 0 ? `Best: ${peak.toFixed(1)}°` : "Best: --°";
        }

        setChartEmptyState(romChartWrap, romEmptyEl, series.noData);

        romChart = renderTrendChart(romCanvas, romChart, "Finger Movement (°)", series.labels, series.values, {
            unit: "°",
            peakLabelPrefix: "Best",
            showPeakLabel: false,
            showPointLabels: !series.noData && romViewState.showValues,
            chartType: series.chartType,
            fillArea: true,
            showLegend: true,
            lineColor: "#4d869c",
            pointBackgroundColor: "#4d869c",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.35
        });
    }

    function renderAnalyticsTrends() {
        updateCardControls(forceViewState, forceToggleButtons, forceNav, forceRangeLabel, forceNextBtn, "force");
        updateCardControls(romViewState, romToggleButtons, romNav, romRangeLabel, romNextBtn, "rom");
        renderForceTrend();
        renderRomTrend();
    }

    function renderSessionList() {
        if (!recentList) {
            return;
        }

        const source = logs.slice(0, 5);
        if (!source.length) {
            recentList.innerHTML = '<li class="recovery-session-item is-empty">No sessions recorded yet.</li>';
        } else {
            recentList.innerHTML = source.map(log => {
                const statusMeta = normalizeRecoveryStatus(log.status);
                return `
                    <li class="recovery-session-item">
                        <div class="recovery-session-main">
                            <div class="recovery-session-date">${formatLogDate(log.timestamp)}</div>
                            <div class="recovery-session-metrics">${Number(log.repetitions || 0)} reps • ${Number(log.grip_strength || 0).toFixed(1)} N</div>
                        </div>
                        <span class="recovery-status-badge ${statusMeta.className}">${statusMeta.label}</span>
                    </li>
                `;
            }).join("");
        }

        if (viewAllBtn) {
            viewAllBtn.hidden = logs.length <= 5;
            viewAllBtn.textContent = "View All Sessions";
        }
    }

    function renderAllSessionsList() {
        if (!allSessionsList) {
            return;
        }

        if (!logs.length) {
            allSessionsList.innerHTML = '<li class="recovery-session-item is-empty">No sessions recorded yet.</li>';
            return;
        }

        function formatExerciseType(type) {
            const normalized = String(type || "")
                .trim()
                .replace(/[_\s]+/g, " ")
                .toLowerCase();

            if (normalized === "open close hand") {
                return "Open-close Hand";
            }

            return String(type || "")
                .trim()
                .replace(/_/g, " ")
                .replace(/\b\w/g, char => char.toUpperCase());
        }

        allSessionsList.innerHTML = logs.map(log => {
            const statusMeta = normalizeRecoveryStatus(log.status);
            const reps = Number(log.repetitions || 0);
            const bestForce = Number(log.grip_strength || 0);
            const fingerMovement = Number(log.finger_movement || log.flexion_angle || 0);
            const durationSec = Number(log.duration_sec || 0);
            const exerciseType = String(log.exercise_type || "").trim();
            const durationLabel = durationSec > 0
                ? (durationSec >= 60
                    ? `${Math.floor(durationSec / 60)}m ${String(durationSec % 60).padStart(2, "0")}s`
                    : `${durationSec}s`)
                : "";

            return `
                <li class="recovery-session-item recovery-session-item-detailed">
                    <div class="recovery-session-main">
                        <div class="recovery-session-date">${formatLogDate(log.timestamp)}</div>
                        <div class="recovery-session-metric-chips">
                            <span class="recovery-metric-chip"><strong>Reps</strong> ${reps}</span>
                            <span class="recovery-metric-chip"><strong>Best Force</strong> ${bestForce.toFixed(1)} N</span>
                            <span class="recovery-metric-chip"><strong>Best Finger Movement</strong> ${fingerMovement.toFixed(1)}°</span>
                            ${durationLabel ? `<span class="recovery-metric-chip"><strong>Duration</strong> ${durationLabel}</span>` : ""}
                            ${exerciseType ? `<span class="recovery-metric-chip"><strong>Type</strong> ${formatExerciseType(exerciseType)}</span>` : ""}
                        </div>
                    </div>
                    <span class="recovery-status-badge ${statusMeta.className}">${statusMeta.label}</span>
                </li>
            `;
        }).join("");
    }

    function openAllSessionsModal() {
        if (!sessionsModal) {
            return;
        }

        renderAllSessionsList();
        sessionsModal.hidden = false;
        document.body.classList.add("recovery-modal-open");
    }

    function closeAllSessionsModal() {
        if (!sessionsModal) {
            return;
        }

        sessionsModal.hidden = true;
        document.body.classList.remove("recovery-modal-open");
    }

    function renderBestSessions() {
        if (!bestSessionsListEl) {
            return;
        }

        if (!logs.length) {
            bestSessionsListEl.innerHTML = '<li class="recovery-best-session-item is-empty">No sessions yet</li>';
            return;
        }

        const topSessions = [...logs]
            .sort((a, b) => {
                const repsDiff = Number(b.repetitions || 0) - Number(a.repetitions || 0);
                if (repsDiff !== 0) return repsDiff;

                const forceDiff = Number(b.grip_strength || 0) - Number(a.grip_strength || 0);
                if (forceDiff !== 0) return forceDiff;

                return Number(b.flexion_angle || 0) - Number(a.flexion_angle || 0);
            })
            .slice(0, 3);

        bestSessionsListEl.innerHTML = topSessions.map((session, index) => {
            const statusMeta = normalizeRecoveryStatus(session.status);
            return `
                <li class="recovery-best-session-item">
                    <div class="recovery-best-session-rank">#${index + 1}</div>
                    <div class="recovery-best-session-main">
                        <div class="recovery-best-session-date">${formatLogDate(session.timestamp)}</div>
                        <div class="recovery-best-session-metrics">${Number(session.repetitions || 0)} reps • ${Number(session.grip_strength || 0).toFixed(1)} N • ${Number(session.flexion_angle || 0).toFixed(1)}°</div>
                    </div>
                    <span class="recovery-status-badge ${statusMeta.className}">${statusMeta.label}</span>
                </li>
            `;
        }).join("");
    }

    forceToggleButtons.forEach(button => {
        button.addEventListener("click", () => {
            forceViewState.view = String(button.getAttribute("data-view") || "recent");
            if (forceViewState.view !== "daily") {
                forceViewState.weekOffset = 0;
            }
            if (forceViewState.view !== "monthly") {
                forceViewState.monthOffset = 0;
            }
            renderAnalyticsTrends();
        });
    });

    romToggleButtons.forEach(button => {
        button.addEventListener("click", () => {
            romViewState.view = String(button.getAttribute("data-view") || "recent");
            if (romViewState.view !== "daily") {
                romViewState.weekOffset = 0;
            }
            if (romViewState.view !== "monthly") {
                romViewState.monthOffset = 0;
            }
            renderAnalyticsTrends();
        });
    });

    forcePrevBtn?.addEventListener("click", () => {
        if (forceViewState.view === "daily") {
            forceViewState.weekOffset += 1;
        } else if (forceViewState.view === "monthly") {
            forceViewState.monthOffset += 1;
        }
        renderAnalyticsTrends();
    });

    forceShowValuesToggle?.addEventListener("change", () => {
        forceViewState.showValues = Boolean(forceShowValuesToggle.checked);
        renderForceTrend();
    });

    forceNextBtn?.addEventListener("click", () => {
        if (forceViewState.view === "daily") {
            forceViewState.weekOffset = Math.max(0, forceViewState.weekOffset - 1);
        } else if (forceViewState.view === "monthly") {
            forceViewState.monthOffset = Math.max(0, forceViewState.monthOffset - 1);
        }
        renderAnalyticsTrends();
    });

    romPrevBtn?.addEventListener("click", () => {
        if (romViewState.view === "daily") {
            romViewState.weekOffset += 1;
        } else if (romViewState.view === "monthly") {
            romViewState.monthOffset += 1;
        }
        renderAnalyticsTrends();
    });

    romShowValuesToggle?.addEventListener("change", () => {
        romViewState.showValues = Boolean(romShowValuesToggle.checked);
        renderRomTrend();
    });

    romNextBtn?.addEventListener("click", () => {
        if (romViewState.view === "daily") {
            romViewState.weekOffset = Math.max(0, romViewState.weekOffset - 1);
        } else if (romViewState.view === "monthly") {
            romViewState.monthOffset = Math.max(0, romViewState.monthOffset - 1);
        }
        renderAnalyticsTrends();
    });

    viewAllBtn?.addEventListener("click", openAllSessionsModal);
    sessionsBackdrop?.addEventListener("click", closeAllSessionsModal);
    sessionsCloseBtn?.addEventListener("click", closeAllSessionsModal);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && sessionsModal && !sessionsModal.hidden) {
            closeAllSessionsModal();
        }
    });

    fetch("api/patient/recovery.php")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load recovery progress.")))
        .then(payload => {
            if (!payload?.ok) {
                throw new Error(payload?.error || "Unable to load recovery progress.");
            }

            logs = Array.isArray(payload?.logs) ? payload.logs : [];
            recoveryDataReady = true;
            forceViewState.showValues = forceShowValuesToggle ? Boolean(forceShowValuesToggle.checked) : true;
            romViewState.showValues = romShowValuesToggle ? Boolean(romShowValuesToggle.checked) : true;

            const quickStats = payload?.quickStats || {};
            if (totalSessionsEl) {
                totalSessionsEl.textContent = String(Number(quickStats.totalSessions || 0));
            }

            renderBestSessions();
            renderAnalyticsTrends();
            renderSessionList();
        })
        .catch(() => {
            recoveryDataReady = true;
            if (recentList) {
                recentList.innerHTML = '<li class="recovery-session-item is-empty">Unable to load session history.</li>';
            }

            renderAnalyticsTrends();
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
    const fullNameInput = document.getElementById("patientFullName");
    const dateOfBirthInput = document.getElementById("patientDateOfBirth");
    const genderInput = document.getElementById("patientGender");
    const phoneInput = document.getElementById("patientPhone");
    const backupContactInput = document.getElementById("patientBackupContact");
    const usernameInput = document.getElementById("patientUsername");
    const togglePasswordButton = document.getElementById("patientPasswordModalBtn");
    const passwordFields = document.getElementById("patientPasswordFields");
    const passwordModal = document.getElementById("patientPasswordModal");
    const passwordBackdrop = document.getElementById("patientPasswordBackdrop");
    const passwordCloseButton = document.getElementById("patientPasswordClose");
    const passwordCancelButton = document.getElementById("patientPasswordCancel");
    const phoneEditButton = document.getElementById("patientPhoneEditBtn");
    const backupEditButton = document.getElementById("patientBackupEditBtn");
    const currentPasswordInput = document.getElementById("patientCurrentPassword");
    const newPasswordInput = document.getElementById("patientNewPassword");
    const confirmPasswordInput = document.getElementById("patientConfirmPassword");
    const passwordSaveButton = document.getElementById("patientPasswordSaveBtn");
    const feedback = document.getElementById("patientSettingsFeedback");
    const syncStatus = document.getElementById("patientSettingsSyncStatus");
    const diagnosisInput = document.getElementById("patientDiagnosis");
    const assignedDoctorInput = document.getElementById("patientAssignedDoctor");
    const treatmentGoalInput = document.getElementById("patientTreatmentGoal");
    const strokeTypeInput = document.getElementById("patientStrokeType");
    const affectedHandInput = document.getElementById("patientAffectedHand");
    const ageInput = document.getElementById("patientAge");
    const profileCard = form?.closest(".account-info-card") || document.querySelector(".account-info-card");

    let initialPhone = "";
    let initialBackupContact = "";
    let initialUsername = "";
    let isPasswordEditing = false;
    let profileSyncTimer = null;

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

    function setReadonlyValue(input, value, fallback = "Not Provided") {
        if (!input) {
            return;
        }
        const normalized = String(value || "").trim();
        const finalValue = normalized !== "" ? normalized : fallback;
        if (typeof input.value !== "undefined") {
            input.value = finalValue;
        } else {
            input.textContent = finalValue;
        }
    }

    function setEditableDisplay(input, rawValue, emptyLabel = "Not Provided") {
        if (!input) {
            return;
        }
        const normalized = String(rawValue || "").trim();
        input.dataset.rawValue = normalized;
        input.dataset.emptyLabel = emptyLabel;
        input.value = normalized !== "" ? normalized : emptyLabel;
    }

    function getEditableRaw(input) {
        if (!input) {
            return "";
        }
        const typed = String(input.value || "").trim();
        const emptyLabel = String(input.dataset.emptyLabel || "").trim();
        if (typed === emptyLabel && String(input.dataset.rawValue || "").trim() === "") {
            return "";
        }
        return typed;
    }

    function setMedicalInfo(data) {
        const diagnosis = String(data?.diagnosis || "").trim();
        const treatmentGoal = String(data?.treatment_goal || "").trim();

        setReadonlyValue(strokeTypeInput, data?.stroke_type, "Pending Update");
        setReadonlyValue(affectedHandInput, data?.affected_hand, "Pending Update");
        setReadonlyValue(diagnosisInput, diagnosis, "Pending clinical intake");
        setReadonlyValue(assignedDoctorInput, data?.assigned_doctor, "Not assigned");
        setReadonlyValue(treatmentGoalInput, treatmentGoal, "Pending provider update");
    }

    function setPatientAge(ageValue) {
        if (!ageInput) return;
        const parsedAge = Number(ageValue);
        if (Number.isFinite(parsedAge) && parsedAge > 0) {
            ageInput.value = String(parsedAge);
        } else {
            ageInput.value = "Not Provided";
        }
    }

    function isInlineEditing(input) {
        if (!input) {
            return false;
        }
        const group = input.closest(".has-inline-edit");
        return Boolean(group && group.classList.contains("is-editing"));
    }

    function applyPatientSettingsProfile(profile, allowEditableOverwrite = true) {
        if (!profile || typeof profile !== "object") {
            return;
        }

        setReadonlyValue(fullNameInput, profile.full_name, "Not Provided");
        setReadonlyValue(dateOfBirthInput, profile.date_of_birth_display, "Not Provided");
        setPatientAge(profile.age);
        setReadonlyValue(genderInput, profile.gender, "Not Provided");
        setMedicalInfo(profile);

        const nextPhone = String(profile.phone || "").trim();
        const nextBackup = String(profile.backup_contact || "").trim();
        const nextUsername = String(profile.username || "").trim();

        const canOverwritePhone = allowEditableOverwrite && !isInlineEditing(phoneInput);
        const canOverwriteBackup = allowEditableOverwrite && !isInlineEditing(backupContactInput);

        if (canOverwritePhone) {
            initialPhone = nextPhone;
            setEditableDisplay(phoneInput, initialPhone, "Not Provided");
            setFieldEditing(phoneInput?.closest(".has-inline-edit"), phoneInput, phoneEditButton, false);
        }

        if (canOverwriteBackup) {
            initialBackupContact = nextBackup;
            setEditableDisplay(backupContactInput, initialBackupContact, "Not Provided");
            setFieldEditing(backupContactInput?.closest(".has-inline-edit"), backupContactInput, backupEditButton, false);
        }

        if (allowEditableOverwrite) {
            initialUsername = nextUsername;
            setEditableDisplay(usernameInput, initialUsername, "Not Provided");
            if (usernameInput) {
                usernameInput.readOnly = true;
            }
        }
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

    function isValidEmail(value) {
        const trimmed = value.trim();
        if (!trimmed) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }

    function isValidBackupContact(value) {
        const trimmed = value.trim();
        if (!trimmed) return true;
        const compact = trimmed.replace(/\s+/g, "");
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || /^[+]?\d{7,15}$/.test(compact);
    }

    function isValidUsername(value) {
        const trimmed = value.trim();
        if (!trimmed) return false;
        return /^[A-Za-z0-9_.-]{3,50}$/.test(trimmed);
    }

    function setFieldEditing(fieldGroup, input, button, enabled) {
        if (fieldGroup) {
            fieldGroup.classList.toggle("is-editing", enabled);
        }
        if (input) {
            input.readOnly = !enabled;
            if (enabled) {
                const rawValue = String(input.dataset.rawValue || "").trim();
                input.value = rawValue;
                input.focus();
                input.select();
            } else {
                const rawValue = String(input.dataset.rawValue || "").trim();
                const emptyLabel = String(input.dataset.emptyLabel || "Not Provided").trim();
                input.value = rawValue !== "" ? rawValue : emptyLabel;
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

    async function fetchSettingsSnapshot() {
        try {
            const response = await fetch("api/patient/settings.php", {
                method: "GET",
                headers: { "Accept": "application/json" },
                cache: "no-store"
            });
            const rawText = await response.text();
            let payload = {};
            try {
                payload = rawText ? JSON.parse(rawText) : {};
            } catch {
                payload = {};
            }

            if (!response.ok || !payload?.ok || !payload?.profile) {
                return null;
            }

            return {
                phone: String(payload.profile.phone || "").trim(),
                backup_contact: String(payload.profile.backup_contact || "").trim(),
                username: String(payload.profile.username || "").trim(),
                syncStatus: String(payload.syncStatus || "").trim()
            };
        } catch {
            return null;
        }
    }

    async function syncProfileUpdate({ phone, backupContact, username, currentPassword, newPassword }, button) {
        if (button) {
            button.classList.add("is-saving");
        }
        setFeedback("Saving changes...");
        setSyncStatus("");

        try {
            const response = await fetch("api/patient/settings.php", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    backupContact,
                    username,
                    currentPassword,
                    newPassword
                })
            });
            const responseText = await response.text();
            let payload = {};
            try {
                payload = responseText ? JSON.parse(responseText) : {};
            } catch {
                payload = {};
            }

            if (!response.ok || !payload?.ok) {
                const expectedPhone = String(phone || "").trim();
                const expectedBackup = String(backupContact || "").trim();
                const expectedUsername = String(username || "").trim();
                const latestProfile = await fetchSettingsSnapshot();

                if (
                    latestProfile &&
                    latestProfile.phone === expectedPhone &&
                    latestProfile.backup_contact === expectedBackup &&
                    latestProfile.username === expectedUsername
                ) {
                    payload = {
                        ok: true,
                        profile: latestProfile,
                        syncStatus: latestProfile.syncStatus || ""
                    };
                } else {
                    throw new Error(payload?.error || "Unable to sync updates.");
                }
            }

            initialPhone = String(payload.profile?.phone || phone || "").trim();
            initialBackupContact = String(payload.profile?.backup_contact || backupContact || "").trim();
            initialUsername = String(payload.profile?.username || username || "").trim();
            setEditableDisplay(phoneInput, initialPhone, "Not Provided");
            setEditableDisplay(backupContactInput, initialBackupContact, "Not Provided");
            setEditableDisplay(usernameInput, initialUsername, "Not Provided");

            setFeedback("");
            setSyncStatus("Changes saved.");
        } catch (error) {
            setFeedback("Changes failed. Please try again.");
            setSyncStatus("");
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

    togglePasswordButton?.addEventListener("click", () => setPasswordEditing(true));
    passwordCloseButton?.addEventListener("click", () => setPasswordEditing(false));
    passwordCancelButton?.addEventListener("click", () => setPasswordEditing(false));
    passwordBackdrop?.addEventListener("click", () => setPasswordEditing(false));
    window.addEventListener("keydown", event => {
        if (event.key === "Escape" && passwordModal && !passwordModal.hidden) {
            setPasswordEditing(false);
        }
    });

    phoneEditButton?.addEventListener("click", () => {
        const group = phoneEditButton.closest(".has-inline-edit");
        const editing = group?.classList.contains("is-editing");
        if (!editing) {
            setFieldEditing(group, phoneInput, phoneEditButton, true);
            return;
        }

        const nextPhone = getEditableRaw(phoneInput);
        if (!isValidEmail(nextPhone)) {
            setFeedback("Email address must be valid.");
            return;
        }

        setEditableDisplay(phoneInput, nextPhone, "Not Provided");
        setFieldSaving(group, phoneInput, phoneEditButton);
        void syncProfileUpdate({
            phone: nextPhone,
            backupContact: String(backupContactInput?.dataset.rawValue || ""),
            username: String(usernameInput?.dataset.rawValue || "")
        }, phoneEditButton);
    });

    backupEditButton?.addEventListener("click", () => {
        const group = backupEditButton.closest(".has-inline-edit");
        const editing = group?.classList.contains("is-editing");
        if (!editing) {
            setFieldEditing(group, backupContactInput, backupEditButton, true);
            return;
        }

        const nextBackup = getEditableRaw(backupContactInput);
        if (nextBackup.length > 255) {
            setFeedback("Backup contact must be 255 characters or fewer.");
            return;
        }

        if (!isValidBackupContact(nextBackup)) {
            setFeedback("Backup contact must be a valid phone number or email address.");
            return;
        }

        setEditableDisplay(backupContactInput, nextBackup, "Not Provided");
        setFieldSaving(group, backupContactInput, backupEditButton);
        void syncProfileUpdate({
            phone: String(phoneInput?.dataset.rawValue || ""),
            backupContact: nextBackup,
            username: String(usernameInput?.dataset.rawValue || "")
        }, backupEditButton);
    });


    function updatePasswordSaveState() {
        if (!passwordSaveButton || !isPasswordEditing) return;
        const currentPassword = String(currentPasswordInput?.value || "");
        const newPassword = String(newPasswordInput?.value || "");
        const confirmPassword = String(confirmPasswordInput?.value || "");
        const strongPassword = newPassword.length >= 6 && /[A-Z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
        passwordSaveButton.disabled = !(currentPassword && newPassword && confirmPassword && newPassword === confirmPassword && strongPassword);
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

        if (!(newPassword.length >= 6 && /[A-Z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword))) {
            setFeedback("Password must be at least 6 characters with 1 uppercase letter, 1 number, and 1 special character.");
            return;
        }

        if (passwordSaveButton) {
            passwordSaveButton.classList.add("is-loading");
            passwordSaveButton.disabled = true;
        }

        void syncProfileUpdate(
            {
                phone: String(phoneInput?.dataset.rawValue || ""),
                backupContact: String(backupContactInput?.dataset.rawValue || ""),
                username: String(usernameInput?.dataset.rawValue || ""),
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

    fetch("api/patient/profile.php", { cache: "no-store" })
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load patient profile.")))
        .then(payload => {
            if (!payload?.ok || !payload?.profile) {
                throw new Error(payload?.error || "Unable to load patient profile.");
            }

            applyPatientSettingsProfile(payload.profile || {}, true);

            setFeedback("");
            setSyncStatus(payload.syncStatus || "");

            if (profileSyncTimer === null) {
                profileSyncTimer = window.setInterval(() => {
                    if (document.hidden || isPasswordEditing) {
                        return;
                    }

                    fetch("api/patient/profile.php", { cache: "no-store" })
                        .then(response => response.ok ? response.json() : null)
                        .then(livePayload => {
                            if (!livePayload?.ok || !livePayload?.profile) {
                                return;
                            }

                            applyPatientSettingsProfile(livePayload.profile, true);
                        })
                        .catch(() => {
                            // Keep current visible state until next successful poll.
                        });
                }, 15000);
            }
        })
        .catch(() => {
            setFeedback("Unable to load profile settings.");
            setMedicalInfo({});
            setPatientAge(null);
            setReadonlyValue(fullNameInput, "", "Not Provided");
            setReadonlyValue(dateOfBirthInput, "", "Not Provided");
            setReadonlyValue(genderInput, "", "Not Provided");
            setEditableDisplay(phoneInput, "", "Not Provided");
            setEditableDisplay(backupContactInput, "", "Not Provided");
            setEditableDisplay(usernameInput, "", "Not Provided");
        });
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
    const notesPanel = document.querySelector(".doctor-panel-notes");
    const notesEditButton = document.getElementById("settingsNotesEditBtn");
    const notesSaveButton = document.getElementById("settingsNotesSaveBtn");
    const emailInput = document.getElementById("settingsEmail");
    const securityEmailInput = document.getElementById("settingsSecurityEmail");
    const passwordMaskInput = document.getElementById("settingsPasswordMask");
    const doctorYearsExperienceInput = document.getElementById("doctorYearsExperience");
    const doctorContactNumberInput = document.getElementById("doctorContactNumber");
    const doctorUsernameInput = document.getElementById("doctorUsername");
    const notificationPreferenceInput = document.getElementById("settingsNotificationPreference");
    const togglePasswordButton = document.getElementById("settingsTogglePasswordBtn");
    const passwordToggleWrap = togglePasswordButton?.closest(".settings-password-toggle-wrap") || null;
    const quickPasswordButton = document.getElementById("settingsQuickPasswordBtn");
    const passwordFields = document.getElementById("settingsPasswordFields");
    const currentPasswordInput = document.getElementById("settingsCurrentPassword");
    const newPasswordInput = document.getElementById("settingsNewPassword");
    const confirmPasswordInput = document.getElementById("settingsConfirmPassword");
    const passwordVisibilityButtons = Array.from(document.querySelectorAll(".settings-password-visibility[data-password-target]"));
    const passwordCancelButton = document.getElementById("settingsPasswordCancelBtn");
    const passwordSaveButton = document.getElementById("settingsPasswordSaveBtn");
    const doctorInlineEditButtons = Array.from(document.querySelectorAll(".doctor-inline-edit-btn[data-inline-edit-target]"));
    const successToast = document.getElementById("settingsSuccessToast");
    const settingsError = document.getElementById("settingsFormError");
    const miniNavButtons = Array.from(document.querySelectorAll(".settings-mini-nav-btn"));
    const doctorFilesAddButton = document.getElementById("doctorFilesAddBtn");
    const doctorFilesInput = document.getElementById("doctorFilesInput");
    const doctorFilesList = document.getElementById("doctorFilesList");
    const doctorFileDeleteModal = document.getElementById("doctorFileDeleteModal");
    const doctorFileDeleteMessage = document.getElementById("doctorFileDeleteMessage");
    const doctorFileDeleteCancelBtn = document.getElementById("doctorFileDeleteCancelBtn");
    const doctorFileDeleteConfirmBtn = document.getElementById("doctorFileDeleteConfirmBtn");

    function initializeSettingsMiniNav() {
        if (!miniNavButtons.length) {
            return;
        }

        function activateButton(button) {
            miniNavButtons.forEach(navButton => {
                navButton.classList.toggle("is-active", navButton === button);
            });

            const targetId = button.getAttribute("data-target");
            if (!targetId) {
                return;
            }

            const pane = document.getElementById(targetId);
            if (!pane) {
                return;
            }

            const allPanes = Array.from(document.querySelectorAll(".settings-pane-grid .settings-section"));
            allPanes.forEach(sectionPane => sectionPane.classList.remove("is-focused"));
            pane.classList.add("is-focused");
        }

        miniNavButtons.forEach((button, index) => {
            if (index === 0) {
                activateButton(button);
            }

            button.addEventListener("click", () => {
                activateButton(button);
            });
        });
    }

    const defaultProfile = {
        displayName: "",
        username: "",
        title: "",
        specialty: "Neurology",
        hospital: "",
        contactNumber: "",
        yearsOfExperience: "",
        bio: "",
        email: "",
        avatarDataUrl: ""
    };

    let draftProfile = { ...defaultProfile };
    let isPasswordEditing = false;
    let isSettingsEditable = true;
    let isNotesEditing = false;
    let isCurrentPasswordValid = false;
    let currentPasswordValidationTimer = null;
    let currentPasswordValidationToken = 0;
    let pendingDeleteDocumentId = 0;
    let pendingDeleteDocumentName = "";

    function openDeleteModal(documentId, documentName) {
        pendingDeleteDocumentId = Number(documentId) || 0;
        pendingDeleteDocumentName = String(documentName || "this file");

        if (doctorFileDeleteMessage) {
            doctorFileDeleteMessage.textContent = `Are you sure you want to delete ${pendingDeleteDocumentName}?`;
        }

        if (doctorFileDeleteModal) {
            doctorFileDeleteModal.hidden = false;
            doctorFileDeleteModal.setAttribute("aria-hidden", "false");
        }
    }

    function closeDeleteModal() {
        pendingDeleteDocumentId = 0;
        pendingDeleteDocumentName = "";

        if (doctorFileDeleteModal) {
            doctorFileDeleteModal.hidden = true;
            doctorFileDeleteModal.setAttribute("aria-hidden", "true");
        }
    }

    function formatFileSize(sizeBytes) {
        const bytes = Number(sizeBytes) || 0;
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        const units = ["KB", "MB", "GB"];
        let value = bytes / 1024;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
    }

    function renderDoctorDocuments(documents) {
        if (!(doctorFilesList instanceof HTMLUListElement)) {
            return;
        }

        doctorFilesList.innerHTML = "";
        if (!Array.isArray(documents) || documents.length === 0) {
            const emptyItem = document.createElement("li");
            emptyItem.className = "doctor-files-empty";
            emptyItem.innerHTML = '<i class="fa-regular fa-folder-open" aria-hidden="true"></i><span>No uploaded PDF files yet.</span>';
            doctorFilesList.appendChild(emptyItem);
            return;
        }

        documents.forEach(documentEntry => {
            const fileName = String(documentEntry?.name || "Untitled.pdf");
            const fileUrl = String(documentEntry?.url || "");
            const fileSize = formatFileSize(documentEntry?.sizeBytes);

            const item = document.createElement("li");
            const icon = document.createElement("i");
            icon.className = "fa-regular fa-file-lines";
            icon.setAttribute("aria-hidden", "true");

            const content = document.createElement("span");
            content.className = "doctor-file-entry";

            if (fileUrl) {
                const link = document.createElement("a");
                link.href = fileUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = fileName;
                content.appendChild(link);
            } else {
                const text = document.createElement("span");
                text.textContent = fileName;
                content.appendChild(text);
            }

            const meta = document.createElement("small");
            meta.textContent = fileSize;
            content.appendChild(meta);

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "doctor-file-delete-btn";
            deleteButton.setAttribute("aria-label", `Delete ${fileName}`);
            deleteButton.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i>';
            deleteButton.addEventListener("click", () => {
                openDeleteModal(documentEntry?.id, fileName);
            });

            item.appendChild(icon);
            item.appendChild(content);
            item.appendChild(deleteButton);
            doctorFilesList.appendChild(item);
        });
    }

    async function deleteDoctorDocument(documentId) {
        const nextId = Number(documentId) || 0;
        if (nextId <= 0) {
            return;
        }

        setSettingsMessage("Deleting file...");

        try {
            const response = await fetch("api/doctor/documents.php", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ documentId: nextId })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Unable to delete file.");
            }

            closeDeleteModal();
            await loadDoctorDocuments();
            setSettingsMessage("");
            showSuccessToast();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to delete file.";
            setSettingsMessage(message);
        }
    }

    async function loadDoctorDocuments() {
        if (!(doctorFilesList instanceof HTMLUListElement)) {
            return;
        }

        try {
            const response = await fetch("api/doctor/documents.php", {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Unable to load files.");
            }

            renderDoctorDocuments(payload.documents || []);
        } catch (error) {
            renderDoctorDocuments([]);
            const message = error instanceof Error ? error.message : "Unable to load files.";
            setSettingsMessage(message);
        }
    }

    async function uploadDoctorDocument(file) {
        if (!(file instanceof File)) {
            return;
        }

        const normalizedName = file.name.toLowerCase();
        const isPdf = normalizedName.endsWith(".pdf") || file.type === "application/pdf";
        if (!isPdf) {
            setSettingsMessage("Only PDF files are allowed.");
            return;
        }

        const formData = new FormData();
        formData.append("document", file);

        setSettingsMessage("Uploading file...");

        try {
            const response = await fetch("api/doctor/documents.php", {
                method: "POST",
                headers: {
                    "Accept": "application/json"
                },
                body: formData
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Unable to upload file.");
            }

            if (doctorFilesInput instanceof HTMLInputElement) {
                doctorFilesInput.value = "";
            }

            await loadDoctorDocuments();
            setSettingsMessage("");
            showSuccessToast();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to upload file.";
            setSettingsMessage(message);
        }
    }

    function setInlineDoctorFieldEditing(fieldElement, toggleButton, enabled) {
        if (!fieldElement || !toggleButton) {
            return;
        }

        const fieldGroup = fieldElement.closest(".has-field-edit");
        if (fieldGroup) {
            fieldGroup.classList.toggle("is-editing", enabled);
        }

        if (fieldElement instanceof HTMLSelectElement) {
            fieldElement.disabled = !enabled;
        } else {
            fieldElement.readOnly = !enabled;
        }

        toggleButton.classList.toggle("is-editing", enabled);
        toggleButton.setAttribute("aria-label", enabled ? "Done editing" : "Edit field");

        const icon = toggleButton.querySelector("i");
        if (icon) {
            icon.className = enabled ? "fa-solid fa-check" : "fa-solid fa-pen";
        }

        if (enabled) {
            fieldElement.focus();
            if (fieldElement instanceof HTMLInputElement || fieldElement instanceof HTMLTextAreaElement) {
                fieldElement.select?.();
            }
        }
    }

    function resetDoctorInlineEditStates() {
        doctorInlineEditButtons.forEach(button => {
            const targetId = String(button.getAttribute("data-inline-edit-target") || "").trim();
            if (!targetId) {
                return;
            }

            const field = document.getElementById(targetId);
            if (!field || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
                return;
            }

            setInlineDoctorFieldEditing(field, button, false);
        });
    }

    function initializeDoctorInlineEditButtons() {
        if (!doctorInlineEditButtons.length) {
            return;
        }

        doctorInlineEditButtons.forEach(button => {
            const targetId = String(button.getAttribute("data-inline-edit-target") || "").trim();
            if (!targetId) {
                return;
            }

            const field = document.getElementById(targetId);
            if (!field || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
                return;
            }

            field.addEventListener("mousedown", event => {
                if (button.classList.contains("is-editing")) {
                    return;
                }

                event.preventDefault();
            });

            field.addEventListener("focus", () => {
                if (button.classList.contains("is-editing")) {
                    return;
                }

                field.blur();
            });

            button.addEventListener("click", () => {
                const isEditing = button.classList.contains("is-editing");
                if (!isEditing) {
                    setInlineDoctorFieldEditing(field, button, true);
                    return;
                }

                setInlineDoctorFieldEditing(field, button, false);
                const isPasswordField = ["settingsCurrentPassword", "settingsNewPassword", "settingsConfirmPassword"].includes(targetId);
                if (!isPasswordField) {
                    settingsForm?.requestSubmit();
                }
            });
        });
    }

    function updatePasswordSaveButtonState() {
        if (!passwordSaveButton) {
            return;
        }

        const isMatch = updatePasswordMatchIndicator();
        const canSave = isPasswordEditing
            && Boolean(currentPasswordInput?.value.trim())
            && Boolean(newPasswordInput?.value.trim())
            && Boolean(confirmPasswordInput?.value.trim())
            && isMatch
            && isCurrentPasswordValid;

        passwordSaveButton.disabled = !canSave;
    }

    function updateCurrentPasswordIndicator(isValid) {
        if (!currentPasswordInput) {
            return;
        }

        currentPasswordInput.classList.remove("is-match", "is-mismatch");
        if (!isPasswordEditing || !currentPasswordInput.value.trim()) {
            return;
        }

        currentPasswordInput.classList.add(isValid ? "is-match" : "is-mismatch");
    }

    async function validateCurrentPasswordLive() {
        if (!isPasswordEditing || !currentPasswordInput) {
            return;
        }

        const value = currentPasswordInput.value.trim();
        if (!value) {
            isCurrentPasswordValid = false;
            updateCurrentPasswordIndicator(false);
            updatePasswordSaveButtonState();
            return;
        }

        const token = ++currentPasswordValidationToken;

        try {
            const response = await fetch("api/doctor/verify_password.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ currentPassword: value })
            });

            const payload = await response.json().catch(() => ({}));
            if (token !== currentPasswordValidationToken) {
                return;
            }

            isCurrentPasswordValid = Boolean(response.ok && payload?.ok && payload?.valid === true);
            updateCurrentPasswordIndicator(isCurrentPasswordValid);
            updatePasswordSaveButtonState();
        } catch {
            if (token !== currentPasswordValidationToken) {
                return;
            }

            isCurrentPasswordValid = false;
            updateCurrentPasswordIndicator(false);
            updatePasswordSaveButtonState();
        }
    }

    function updatePasswordMatchIndicator() {
        if (!newPasswordInput || !confirmPasswordInput) {
            return false;
        }

        confirmPasswordInput.classList.remove("is-match", "is-mismatch");

        const newValue = newPasswordInput.value.trim();
        const confirmValue = confirmPasswordInput.value.trim();
        if (!isPasswordEditing || !newValue || !confirmValue) {
            return false;
        }

        const isMatch = newValue === confirmValue;
        confirmPasswordInput.classList.add(isMatch ? "is-match" : "is-mismatch");
        return isMatch;
    }

    function lockNonEditableDoctorFields() {
        const lockedControls = [doctorYearsExperienceInput, doctorUsernameInput, securityEmailInput, passwordMaskInput];
        lockedControls.forEach(control => {
            if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
                return;
            }

            if (control instanceof HTMLSelectElement) {
                control.disabled = true;
            } else {
                control.readOnly = true;
            }

            control.tabIndex = -1;

            control.addEventListener("mousedown", event => {
                event.preventDefault();
            });

            control.addEventListener("focus", () => {
                control.blur();
            });
        });
    }

    function setSettingsEditable(enabled) {
        isSettingsEditable = enabled;

        if (togglePasswordButton) {
            togglePasswordButton.disabled = !enabled;
        }
        if (quickPasswordButton) {
            quickPasswordButton.disabled = !enabled;
        }
        if (cancelButton) {
            cancelButton.disabled = !enabled;
        }

        if (!enabled) {
            setPasswordEditing(false);
        }

        settingsForm?.classList.toggle("is-locked", !enabled);
        if (enabled) {
            resetDoctorInlineEditStates();
        }
    }

    function mergeProfileKeepingFilled(baseProfile, incomingProfile) {
        const merged = { ...baseProfile };
        const source = incomingProfile || {};

        Object.keys(defaultProfile).forEach(key => {
            const nextValue = source[key];

            if (typeof nextValue === "string") {
                const trimmed = nextValue.trim();
                if (trimmed !== "") {
                    merged[key] = nextValue;
                }
                return;
            }

            if (nextValue !== undefined && nextValue !== null) {
                merged[key] = nextValue;
            }
        });

        return merged;
    }

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

    function setNotesEditing(enabled) {
        isNotesEditing = enabled;

        if (bioInput) {
            bioInput.readOnly = !enabled;
            if (enabled) {
                bioInput.focus();
                const length = bioInput.value.length;
                bioInput.setSelectionRange(length, length);
            }
        }

        notesPanel?.classList.toggle("is-editing", enabled);
        if (notesEditButton) {
            notesEditButton.hidden = enabled;
        }
        if (notesSaveButton) {
            notesSaveButton.hidden = !enabled;
            notesSaveButton.disabled = !enabled;
        }
    }

    async function saveProfessionalNotes() {
        if (!bioInput) {
            return;
        }

        const nextBio = bioInput.value.trim();
        setSettingsMessage("Saving notes...");

        try {
            const response = await fetch("api/doctor/settings.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    noteOnly: true,
                    bio: nextBio
                })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Unable to save professional notes.");
            }

            draftProfile.bio = String(payload?.profile?.bio ?? nextBio);
            bioInput.value = draftProfile.bio;
            localStorage.setItem(STORAGE_KEYS.doctorProfile, JSON.stringify(draftProfile));
            setNotesEditing(false);
            setSettingsMessage("");
            showSuccessToast();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to save professional notes.";
            setSettingsMessage(message);
        }
    }

    function clearPasswordFields() {
        if (currentPasswordInput) {
            currentPasswordInput.value = "";
            currentPasswordInput.classList.remove("is-match", "is-mismatch");
        }
        if (newPasswordInput) {
            newPasswordInput.value = "";
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.value = "";
            confirmPasswordInput.setCustomValidity("");
            confirmPasswordInput.classList.remove("is-match", "is-mismatch");
        }
    }

    function setPasswordEditing(enabled) {
        if (!isSettingsEditable && enabled) {
            return;
        }

        isPasswordEditing = enabled;

        if (passwordFields) {
            passwordFields.classList.toggle("is-hidden", !enabled);
        }

        if (togglePasswordButton) {
            togglePasswordButton.textContent = "Change Password";
            togglePasswordButton.setAttribute("aria-expanded", String(enabled));
            togglePasswordButton.hidden = enabled;
        }
        if (passwordToggleWrap) {
            passwordToggleWrap.classList.toggle("is-hidden", enabled);
            passwordToggleWrap.style.display = enabled ? "none" : "";
        }

        [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(control => {
            if (!control) {
                return;
            }

            control.readOnly = !enabled;
        });

        if (!enabled) {
            clearPasswordFields();
        }

        isCurrentPasswordValid = false;
        currentPasswordValidationToken += 1;
        if (currentPasswordValidationTimer !== null) {
            clearTimeout(currentPasswordValidationTimer);
            currentPasswordValidationTimer = null;
        }

        updatePasswordSaveButtonState();
    }

    function initializePasswordVisibilityToggles() {
        if (!passwordVisibilityButtons.length) {
            return;
        }

        passwordVisibilityButtons.forEach(toggleButton => {
            toggleButton.addEventListener("click", () => {
                const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
                if (!targetId) {
                    return;
                }

                const targetInput = document.getElementById(targetId);
                if (!(targetInput instanceof HTMLInputElement)) {
                    return;
                }

                const show = targetInput.type === "password";
                targetInput.type = show ? "text" : "password";
                toggleButton.setAttribute("aria-pressed", String(show));

                const icon = toggleButton.querySelector("i");
                if (icon) {
                    icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
                }
            });
        });
    }

    function normalizeSpecialtySelection(rawValue) {
        const source = String(rawValue || "").trim();
        const compact = source.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

        if (!compact) {
            return "Neurology";
        }

        if (compact === "neurology") {
            return "Neurology";
        }

        if (compact === "pt" || compact === "physical therapy" || compact === "physicaltherapy") {
            return "Physical Therapy";
        }

        if (compact === "rehab" || compact === "rehabilitation") {
            return "Rehabilitation";
        }

        if (compact === "other") {
            return "Other";
        }

        return source;
    }

    function ensureSpecialtyOption(value) {
        if (!specialtyInput || !value || !(specialtyInput instanceof HTMLSelectElement)) {
            return;
        }

        const exists = Array.from(specialtyInput.options).some(option => option.value === value);
        if (exists) {
            return;
        }

        const dynamicOption = document.createElement("option");
        dynamicOption.value = value;
        dynamicOption.textContent = value;
        specialtyInput.insertBefore(dynamicOption, specialtyInput.querySelector('option[value="Other"]') || null);
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
            const normalizedSpecialty = normalizeSpecialtySelection(profile.specialty);
            ensureSpecialtyOption(normalizedSpecialty);
            specialtyInput.value = normalizedSpecialty;
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
        if (securityEmailInput) {
            securityEmailInput.value = profile.email;
        }
        if (doctorYearsExperienceInput) {
            doctorYearsExperienceInput.value = profile.yearsOfExperience || "";
        }
        if (doctorContactNumberInput) {
            doctorContactNumberInput.value = profile.contactNumber || "";
        }
        if (doctorUsernameInput) {
            doctorUsernameInput.value = profile.username || "";
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

            draftProfile = mergeProfileKeepingFilled(
                { ...defaultProfile, ...getStoredProfile() },
                payload.profile
            );

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

    doctorFilesAddButton?.addEventListener("click", () => {
        doctorFilesInput?.click();
    });

    doctorFilesInput?.addEventListener("change", () => {
        const selectedFile = doctorFilesInput.files?.[0];
        if (!selectedFile) {
            return;
        }

        void uploadDoctorDocument(selectedFile);
    });

    doctorFileDeleteCancelBtn?.addEventListener("click", () => {
        closeDeleteModal();
    });

    doctorFileDeleteConfirmBtn?.addEventListener("click", () => {
        void deleteDoctorDocument(pendingDeleteDocumentId);
    });

    doctorFileDeleteModal?.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.hasAttribute("data-modal-close")) {
            closeDeleteModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && doctorFileDeleteModal && !doctorFileDeleteModal.hidden) {
            closeDeleteModal();
        }
    });

    cancelButton?.addEventListener("click", () => {
        draftProfile = getStoredProfile();
        fillForm(draftProfile);
        setPasswordEditing(false);
        setSettingsEditable(true);
        setSettingsMessage("");
    });

    togglePasswordButton?.addEventListener("click", () => {
        setSettingsMessage("");
        setPasswordEditing(!isPasswordEditing);
        if (isPasswordEditing) {
            currentPasswordInput?.focus();
        }
    });

    quickPasswordButton?.addEventListener("click", () => {
        setSettingsMessage("");
        setPasswordEditing(true);
        currentPasswordInput?.focus();
    });

    passwordSaveButton?.addEventListener("click", () => {
        if (!settingsForm || passwordSaveButton.disabled) {
            return;
        }

        settingsForm.requestSubmit();
    });

    passwordCancelButton?.addEventListener("click", () => {
        setSettingsMessage("");
        setPasswordEditing(false);
    });

    notesEditButton?.addEventListener("click", () => {
        setSettingsMessage("");
        setNotesEditing(true);
    });

    notesSaveButton?.addEventListener("click", () => {
        void saveProfessionalNotes();
    });

    [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(control => {
        control?.addEventListener("input", () => {
            if (control === currentPasswordInput) {
                if (currentPasswordValidationTimer !== null) {
                    clearTimeout(currentPasswordValidationTimer);
                }

                isCurrentPasswordValid = false;
                updateCurrentPasswordIndicator(false);
                currentPasswordValidationTimer = setTimeout(() => {
                    void validateCurrentPasswordLive();
                }, 280);
            }
            updatePasswordSaveButtonState();
        });
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

        if (hasPasswordInput && !isCurrentPasswordValid) {
            setSettingsMessage("Current password does not match your account password.");
            return;
        }

        if (hasPasswordInput && nextNew !== nextConfirm) {
            if (confirmPasswordInput) {
                confirmPasswordInput.setCustomValidity("New password and confirm password must match.");
                confirmPasswordInput.reportValidity();
            }
            return;
        }

        if (hasPasswordInput && !(nextNew.length >= 6 && /[A-Z]/.test(nextNew) && /\d/.test(nextNew) && /[^A-Za-z0-9]/.test(nextNew))) {
            setSettingsMessage("New password must be at least 6 characters with 1 uppercase letter, 1 number, and 1 special character.");
            return;
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.setCustomValidity("");
        }

        const specialtyValue = specialtyInput?.value.trim() || "";
        if (!specialtyValue) {
            setSettingsMessage("Please enter your specialty focus.");
            specialtyInput?.focus();
            return;
        }

        const nextProfile = {
            ...draftProfile,
            displayName: displayNameInput?.value.trim() || "",
            title: titleInput?.value.trim() || "",
            specialty: specialtyValue,
            hospital: hospitalInput?.value.trim() || "",
            bio: bioInput ? (bioInput.value.trim() || "") : (draftProfile.bio || ""),
            email: emailInput?.value.trim() || "",
            username: draftProfile.username || "",
            contactNumber: doctorContactNumberInput?.value.trim() || "",
            yearsOfExperience: draftProfile.yearsOfExperience || ""
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

            draftProfile = mergeProfileKeepingFilled(nextProfile, payload.profile);

            localStorage.setItem(STORAGE_KEYS.doctorProfile, JSON.stringify(draftProfile));
            fillForm(draftProfile);
            setPasswordEditing(false);
            setSettingsEditable(true);
            resetDoctorInlineEditStates();
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
    setSettingsEditable(true);
    setNotesEditing(false);
    lockNonEditableDoctorFields();
    initializeSettingsMiniNav();
    initializeDoctorInlineEditButtons();
    initializePasswordVisibilityToggles();
    updatePasswordSaveButtonState();
    void loadProfileFromServer();
    void loadDoctorDocuments();
}

function initializeLogoutFlow() {
    const logoutTriggers = Array.from(document.querySelectorAll('[data-logout-trigger="true"], #logoutBtn'));
    if (!logoutTriggers.length) {
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

    logoutTriggers.forEach(trigger => {
        trigger.addEventListener("click", openModal);
    });
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
        window.location.href = "logout.php";
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

function initializeMobileBottomTabBar() {
    const isPatientMobileNavPage =
        document.body.classList.contains("auth-gated-home") ||
        document.body.classList.contains("patient-portal-page");
    const isDoctorMobileNavPage =
        document.body.classList.contains("doctor-dashboard-page") ||
        document.body.classList.contains("patients-page") ||
        document.body.classList.contains("therapy-plans-page") ||
        document.body.classList.contains("settings-page");

    if (!isPatientMobileNavPage && !isDoctorMobileNavPage) {
        return;
    }

    const menu = document.querySelector(".menu");
    if (!menu) {
        return;
    }

    const menuItems = Array.from(menu.querySelectorAll("li[data-page]"));
    if (!menuItems.length) {
        return;
    }

    const preferredOrder = isDoctorMobileNavPage
        ? ["doctor_dashboard.html", "patients.html", "therapy_plans.html", "settings.html"]
        : ["index.html", "exercise_hub.php", "recovery.php", "patient_settings.php"];
    const selectedItems = preferredOrder
        .map(page => menuItems.find(item => String(item.dataset.page || "") === page))
        .filter(Boolean);

    if (!selectedItems.length) {
        return;
    }

    const existingTabBar = document.querySelector(".mobile-tabbar");
    if (existingTabBar) {
        existingTabBar.remove();
    }

    const nav = document.createElement("nav");
    nav.className = `mobile-tabbar${isDoctorMobileNavPage ? " doctor-tabbar" : ""}`;
    nav.setAttribute("aria-label", "Primary Navigation");

    const list = document.createElement("ul");
    list.className = "mobile-tabbar-list";

    selectedItems.forEach(item => {
        const page = String(item.dataset.page || "");
        const iconEl = item.querySelector("i");
        const iconClass = iconEl ? iconEl.className : "fa-solid fa-circle";
        const originalLabel = String(item.querySelector(".nav-label")?.textContent || "").trim();

        const shortLabelByPage = isDoctorMobileNavPage
            ? {
                "doctor_dashboard.html": "Overview",
                "patients.html": "Patients",
                "therapy_plans.html": "Reports",
                "settings.html": "Settings"
            }
            : {
                "index.html": "Home",
                "exercise_hub.php": "Exercises",
                "recovery.php": "Progress",
                "patient_settings.php": "Profile"
            };

        const itemLabel = shortLabelByPage[page] || originalLabel || "Tab";

        const tabItem = document.createElement("li");
        tabItem.className = "mobile-tabbar-item";

        const link = document.createElement("a");
        link.className = "mobile-tabbar-link";
        link.href = page;
        link.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span>${itemLabel}</span>`;

        const currentPath = window.location.pathname.split("/").pop() || "index.html";
        const isCurrent = currentPath === page || item.classList.contains("active");
        if (isCurrent) {
            link.classList.add("is-active");
            link.setAttribute("aria-current", "page");
        }

        tabItem.appendChild(link);
        list.appendChild(tabItem);
    });

    nav.appendChild(list);
    document.body.appendChild(nav);
}

function initializeDoctorMobileTopBar() {
    const isDoctorPage =
        document.body.classList.contains("doctor-dashboard-page") ||
        document.body.classList.contains("patients-page") ||
        document.body.classList.contains("therapy-plans-page") ||
        document.body.classList.contains("settings-page");

    if (!isDoctorPage) {
        return;
    }

    const existing = document.querySelector(".doctor-mobile-topbar");
    if (existing) {
        existing.remove();
    }

    let profile = {};
    try {
        profile = JSON.parse(localStorage.getItem(STORAGE_KEYS.doctorProfile) || "{}") || {};
    } catch {
        profile = {};
    }

    const doctorName = String(profile.displayName || "Doctor").trim() || "Doctor";
    const clinicMeta = String(profile.hospital || "Clinic ID: --").trim() || "Clinic ID: --";

    const bar = document.createElement("div");
    bar.className = "doctor-mobile-topbar";
    bar.innerHTML = `
        <div class="doctor-mobile-topbar-name">${doctorName}</div>
        <div class="doctor-mobile-topbar-meta">${clinicMeta}</div>
    `;

    document.body.appendChild(bar);
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
        const user = String(formData.get("user") || formData.get("identifier") || "").trim();
        const password = String(formData.get("password") || "");

        if (!user || !password) {
            if (loginError) {
                loginError.textContent = "Please enter your user and password.";
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
                body: JSON.stringify({ user, password })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || "Invalid user or password.");
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
    const wizardDots = wizardForm ? wizardForm.querySelectorAll(".wizard-dot[data-go-step]") : [];
    const passwordToggleButtons = wizardForm ? wizardForm.querySelectorAll(".registration-password-toggle[data-password-target]") : [];
    const stepPanels = wizardForm ? Array.from(wizardForm.querySelectorAll(".form-step")) : [];

    if (!wizardForm || !wizardStage || !stepPanels.length) {
        return;
    }

    let currentStepIndex = 0;
    let emailCheckTimer = null;
    let contactCheckTimer = null;
    let emailCheckToken = 0;
    let contactCheckToken = 0;

    function normalizeContactNumber(value) {
        return String(value || "").replace(/\D/g, "").slice(0, 11);
    }

    function isStrongPassword(value) {
        const password = String(value || "");
        return password.length >= 6 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
    }

    function getFieldGroup(field) {
        return field.closest(".field-group");
    }

    function getFieldErrorNode(field) {
        const fieldGroup = getFieldGroup(field);
        if (!fieldGroup) {
            return null;
        }

        let errorNode = fieldGroup.querySelector(".field-error");
        if (!errorNode) {
            errorNode = document.createElement("small");
            errorNode.className = "field-error";
            errorNode.setAttribute("aria-live", "polite");
            if (field.name) {
                errorNode.setAttribute("data-field-error", field.name);
            }
            fieldGroup.appendChild(errorNode);
        }

        return errorNode;
    }

    function getFieldValidationMessage(field) {
        const value = field.value.trim();

        const remoteError = String(field.dataset.remoteError || "").trim();
        if (remoteError !== "") {
            return remoteError;
        }

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

        if (field.name === "fullName") {
            if (value === "") {
                return "Full name is required.";
            }

            if (!/^[A-Za-z][A-Za-z .']*$/.test(value)) {
                return "Full name can only contain letters, spaces, periods, and apostrophes.";
            }

            return "";
        }

        if (field.name === "password") {
            if (value === "") {
                return "Password is required.";
            }

            if (!isStrongPassword(value)) {
                return "Password must be at least 6 characters with 1 uppercase letter, 1 number, and 1 special character.";
            }

            return "";
        }

        if (field.name === "confirmPassword") {
            if (value === "") {
                return "Confirm password is required.";
            }

            const stepPanel = field.closest(".form-step");
            const passwordField = stepPanel ? stepPanel.querySelector('input[name="password"]') : null;
            const passwordValue = String(passwordField?.value || "");

            if (value !== passwordValue) {
                return "Confirm password must match password.";
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

    async function checkRegistrationAvailability(kind, value) {
        const query = new URLSearchParams({
            check: kind,
            value
        });

        const response = await fetch(`api/registration.php?${query.toString()}`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error || "Unable to validate field right now.");
        }

        return payload;
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

        requestAnimationFrame(updateStageHeight);

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

        wizardDots.forEach(dot => {
            const stepIndex = Number(dot.getAttribute("data-go-step"));
            const isActive = stepIndex === currentStepIndex;
            dot.classList.toggle("is-active", isActive);
            dot.setAttribute("aria-current", isActive ? "step" : "false");
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
            requestAnimationFrame(updateStageHeight);
            return true;
        }

        if (wizardError) {
            wizardError.textContent = "Please correct the highlighted field before continuing.";
        }

        requestAnimationFrame(updateStageHeight);
        firstInvalidField.focus();
        return false;
    }

    stepPanels.forEach((panel, index) => {
        const nextButton = panel.querySelector(".wizard-next");
        const backButton = panel.querySelector(".wizard-back");
        const watchedFields = panel.querySelectorAll("input, select, textarea");

        watchedFields.forEach(field => {
            if (field.name === "email") {
                field.addEventListener("input", () => {
                    field.dataset.remoteError = "";
                    const emailValue = String(field.value || "").trim();
                    setFieldValidationState(field);
                    updateStepButtons();

                    if (wizardError && currentStepIndex === index) {
                        wizardError.textContent = "";
                    }

                    if (emailCheckTimer) {
                        clearTimeout(emailCheckTimer);
                    }

                    if (emailValue === "" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
                        return;
                    }

                    const token = ++emailCheckToken;
                    emailCheckTimer = window.setTimeout(async () => {
                        try {
                            const result = await checkRegistrationAvailability("email", emailValue);
                            if (token !== emailCheckToken) {
                                return;
                            }

                            field.dataset.remoteError = result.available ? "" : "Email already exists.";
                            setFieldValidationState(field);
                            updateStepButtons();
                        } catch {
                            // Keep typing experience smooth when network validation fails.
                        }
                    }, 320);
                });

                field.addEventListener("blur", () => {
                    setFieldValidationState(field);
                });

                return;
            }

            if (field.name === "contactNumber") {
                field.addEventListener("input", () => {
                    field.value = normalizeContactNumber(field.value);
                    field.dataset.remoteError = "";
                    setFieldValidationState(field);
                    if (wizardError && currentStepIndex === index) {
                        wizardError.textContent = "";
                    }
                    updateStepButtons();

                    if (contactCheckTimer) {
                        clearTimeout(contactCheckTimer);
                    }

                    const contactValue = String(field.value || "").trim();
                    if (!/^09\d{9}$/.test(contactValue)) {
                        return;
                    }

                    const token = ++contactCheckToken;
                    contactCheckTimer = window.setTimeout(async () => {
                        try {
                            const result = await checkRegistrationAvailability("contactNumber", contactValue);
                            if (token !== contactCheckToken) {
                                return;
                            }

                            field.dataset.remoteError = result.available ? "" : "Contact number already exists.";
                            setFieldValidationState(field);
                            updateStepButtons();
                        } catch {
                            // Ignore transient availability-check errors.
                        }
                    }, 320);
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

    passwordToggleButtons.forEach(toggleButton => {
        toggleButton.addEventListener("click", () => {
            const targetId = String(toggleButton.getAttribute("data-password-target") || "").trim();
            if (!targetId) {
                return;
            }

            const targetInput = wizardForm.querySelector(`#${targetId}`);
            if (!(targetInput instanceof HTMLInputElement)) {
                return;
            }

            const shouldShowPassword = targetInput.type === "password";
            targetInput.type = shouldShowPassword ? "text" : "password";

            toggleButton.setAttribute("aria-pressed", shouldShowPassword ? "true" : "false");
            toggleButton.setAttribute("aria-label", shouldShowPassword ? "Hide password" : "Show password");

            const icon = toggleButton.querySelector("i");
            if (icon) {
                icon.className = shouldShowPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            }
        });
    });

    wizardDots.forEach(dot => {
        dot.addEventListener("click", () => {
            const targetStep = Number(dot.getAttribute("data-go-step"));
            if (!Number.isInteger(targetStep) || targetStep < 0 || targetStep >= stepPanels.length) {
                return;
            }

            if (targetStep === currentStepIndex) {
                return;
            }

            if (targetStep > currentStepIndex && !validateCurrentStep()) {
                updateStepButtons();
                return;
            }

            renderStep(targetStep);
        });
    });

    wizardForm.addEventListener("keydown", event => {
        if (event.key !== "Enter") {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const tagName = target.tagName;
        if (tagName === "TEXTAREA") {
            return;
        }

        if (target.closest("button, a")) {
            return;
        }

        event.preventDefault();

        if (currentStepIndex < stepPanels.length - 1) {
            if (!validateCurrentStep()) {
                updateStepButtons();
                return;
            }

            renderStep(Math.min(currentStepIndex + 1, stepPanels.length - 1));
            return;
        }

        const submitButton = wizardForm.querySelector(".registration-submit");
        if (submitButton instanceof HTMLButtonElement) {
            if (typeof wizardForm.requestSubmit === "function") {
                wizardForm.requestSubmit(submitButton);
            } else {
                submitButton.click();
            }
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
initializeMetricGraphModal();
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
initializeMessagesPage();
initializeExerciseHubPage();
initializeRecoveryPage();
initializePatientMessagesPage();
initializePatientSettingsPage();
initializeSettingsPage();
initializeLogoutFlow();
initializeNavGuard();
initializeMobileBottomTabBar();
initializeDoctorMobileTopBar();

window.addEventListener("resize", updateActiveIndicator);