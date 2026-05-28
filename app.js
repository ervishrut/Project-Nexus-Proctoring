/**
 * Nexus Proctor - app.js
 * App view routing, authentications, exam workflows, offline cache control,
 * proctor integrations, professor panels, AI generation engines, and admin charts.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check global availability
    const DB = window.NexusDB;
    const Proctor = window.Proctor;

    if (!DB || !Proctor) {
        console.error("Critical components db.js or proctor.js missing from namespace.");
        return;
    }

    // App core state
    const AppState = {
        currentUser: null,
        currentRole: null, // 'student', 'professor', 'admin'
        activeView: 'login',
        isOnline: true,
        currentExam: null,
        currentQuestionIndex: 0,
        examTimerInterval: null,
        remainingTime: 0,
        examAnswers: {}, // key: questionId, value: response
        bookmarkedQuestions: new Set(),
        walletCredits: DB.getWalletBalance(),
        telemetryLoop: null,
        verificationMeshPoints: []
    };

    // DOM Elements Cache
    const el = {
        authContainer: document.getElementById('auth-container'),
        appLayout: document.getElementById('app-layout'),
        sidebarMenu: document.getElementById('sidebar-menu'),
        profileWidget: document.getElementById('profile-widget'),
        viewportHeader: document.getElementById('viewport-header'),
        viewportTitle: document.getElementById('viewport-title'),
        viewportContent: document.getElementById('viewport-content'),
        walletBalance: document.getElementById('wallet-balance'),
        onlineStatusText: document.getElementById('online-status-text'),
        onlineStatusDot: document.getElementById('online-status-dot'),
        
        // Views containers
        viewStudentDash: document.getElementById('view-student-dash'),
        viewProfessorDash: document.getElementById('view-professor-dash'),
        viewAdminDash: document.getElementById('view-admin-dash'),
        viewExamWorkspace: document.getElementById('exam-workspace-frame'),
        
        // Forms
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        forgotForm: document.getElementById('forgot-form'),
        
        // Dynamic grids/lists
        availableExamsList: document.getElementById('available-exams-list'),
        studentHistoryList: document.getElementById('student-history-list'),
        profMonitoringGrid: document.getElementById('prof-monitoring-grid'),
        blockchainLogsTable: document.getElementById('blockchain-logs-table')
    };

    // Sub-routes/Views toggler
    function showView(viewName) {
        AppState.activeView = viewName;
        
        // Hide all major screens
        el.viewStudentDash.style.display = 'none';
        el.viewProfessorDash.style.display = 'none';
        el.viewAdminDash.style.display = 'none';
        el.viewExamWorkspace.style.display = 'none';
        
        if (viewName === 'student') {
            el.authContainer.style.display = 'none';
            el.appLayout.style.display = 'flex';
            el.viewStudentDash.style.display = 'block';
            el.viewportHeader.style.display = 'flex';
            renderStudentDashboard();
        } else if (viewName === 'professor') {
            el.authContainer.style.display = 'none';
            el.appLayout.style.display = 'flex';
            el.viewProfessorDash.style.display = 'block';
            el.viewportHeader.style.display = 'flex';
            renderProfessorDashboard();
        } else if (viewName === 'admin') {
            el.authContainer.style.display = 'none';
            el.appLayout.style.display = 'flex';
            el.viewAdminDash.style.display = 'block';
            el.viewportHeader.style.display = 'flex';
            renderAdminDashboard();
        } else if (viewName === 'exam') {
            el.appLayout.style.display = 'none';
            el.viewExamWorkspace.style.display = 'flex';
            renderExamWorkspace();
        } else {
            // Login screens
            el.authContainer.style.display = 'flex';
            el.appLayout.style.display = 'none';
            el.viewExamWorkspace.style.display = 'none';
            showAuthCard(viewName);
        }
    }

    function showAuthCard(cardId) {
        el.loginForm.style.display = cardId === 'login' ? 'block' : 'none';
        el.registerForm.style.display = cardId === 'register' ? 'block' : 'none';
        el.forgotForm.style.display = cardId === 'forgot' ? 'block' : 'none';
    }

    // Toggle Online/Offline State
    window.toggleNetworkState = function() {
        AppState.isOnline = !AppState.isOnline;
        if (AppState.isOnline) {
            el.onlineStatusText.textContent = "SECURE SYNC ONLINE";
            el.onlineStatusDot.classList.remove('offline');
            Proctor.logSecurityEvent('NETWORK_ONLINE', { detail: 'Local terminal reconnected to cloud network.' });
            triggerOfflineQueueSync();
        } else {
            el.onlineStatusText.textContent = "CACHED OFFLINE MODE";
            el.onlineStatusDot.classList.add('offline');
            Proctor.logSecurityEvent('NETWORK_OFFLINE', { detail: 'Local terminal offline. Secured local database active.' });
            showWarningFlash('Offline Mode Engaged', 'All answers will be stored in local AES-256 encrypted storage until network is restored.');
        }
    };

    // Warning notification overlays
    function showWarningFlash(title, desc) {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '20px';
        flash.style.right = '20px';
        flash.style.background = 'rgba(20, 20, 22, 0.95)';
        flash.style.border = '1px solid var(--gold-accent)';
        flash.style.padding = '16px';
        flash.style.zIndex = '1000';
        flash.style.width = '300px';
        flash.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
        flash.innerHTML = `
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--gold-accent); margin-bottom: 4px;">SYSTEM MESSAGE</div>
            <div style="font-weight: 700; color: #FFF; font-size: 12px; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${desc}</div>
        `;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 4000);
    }

    // Offline queue sync pipeline
    async function triggerOfflineQueueSync() {
        const queue = DB.getOfflineQueue();
        if (queue.length === 0) return;

        showWarningFlash('Syncing Data', `Synchronizing ${queue.length} buffered answers with integrity check...`);
        
        // Simulating hash check sync delay
        setTimeout(async () => {
            const syncedLogs = [];
            for (let item of queue) {
                // Verify integrity using DB model
                await Proctor.logSecurityEvent('OFFLINE_SYNC_ITEM', {
                    examId: item.examId,
                    questionId: item.questionId,
                    decryptedResponseLength: String(item.response).length
                });
                
                // Save locally
                AppState.examAnswers[item.questionId] = item.response;
            }
            
            DB.clearOfflineQueue();
            showWarningFlash('Sync Complete', 'Integrity chain validated. Cache synced successfully.');
        }, 1500);
    }

    // ==========================================
    // AUTHENTICATION CONTROLLERS
    // ==========================================
    window.handleLoginSubmit = function(event) {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;

        // Perform face scanning simulation block
        const scanSection = document.getElementById('login-biometric-scanner');
        scanSection.style.display = 'flex';
        
        const video = document.getElementById('login-scan-video');
        let stream = null;

        // Try getting video stream
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                stream = s;
                video.srcObject = s;
                video.play();
            })
            .catch(() => {
                console.log("No real camera found. Starting virtual scanner reticles.");
            });

        let confidence = 0;
        const scoreVal = document.getElementById('scan-confidence-val');
        
        const interval = setInterval(() => {
            confidence += Math.floor(Math.random() * 20) + 5;
            if (confidence >= 98.4) {
                confidence = 98.4;
                clearInterval(interval);
                
                // Authentication Success Roles Routing
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                
                AppState.currentUser = email;
                
                if (email.includes('admin')) {
                    AppState.currentRole = 'admin';
                    showView('admin');
                } else if (email.includes('prof')) {
                    AppState.currentRole = 'professor';
                    showView('professor');
                } else {
                    AppState.currentRole = 'student';
                    showView('student');
                }
                
                Proctor.logSecurityEvent('AUTH_SUCCESS', { user: email, biometricMatch: '98.4%' });
                setupUserProfile();
            }
            scoreVal.textContent = confidence.toFixed(1) + '%';
        }, 120);
    };

    window.toggleForgotPassword = function() {
        showAuthCard('forgot');
    };

    window.toggleRegistration = function() {
        showAuthCard('register');
    };

    window.toggleLogin = function() {
        showAuthCard('login');
    };

    window.handleRegisterSubmit = function(event) {
        event.preventDefault();
        showWarningFlash('Success', 'Biometric credential logged. Return to login panel.');
        showAuthCard('login');
    };

    window.handleForgotSubmit = function(event) {
        event.preventDefault();
        showWarningFlash('OTP Sent', 'Temporary passcode delivered to registered terminal.');
        showAuthCard('login');
    };

    window.handleLogout = function() {
        Proctor.stop();
        if (AppState.telemetryLoop) clearInterval(AppState.telemetryLoop);
        AppState.currentUser = null;
        AppState.currentRole = null;
        showView('login');
    };

    function setupUserProfile() {
        const avatar = el.profileWidget.querySelector('.user-avatar-placeholder');
        const nameEl = el.profileWidget.querySelector('.profile-name');
        const roleEl = el.profileWidget.querySelector('.profile-role');

        let initials = "ST";
        let displayRole = "CANDIDATE";
        let displayName = "Kaelen Vance";

        if (AppState.currentRole === 'admin') {
            initials = "AD";
            displayRole = "CHIEF AUDITOR";
            displayName = "Sarah Vance";
            el.walletBalance.parentElement.style.display = 'block';
        } else if (AppState.currentRole === 'professor') {
            initials = "PR";
            displayRole = "PROCTOR IN-CHARGE";
            displayName = "Dr. Evelyn Croft";
            el.walletBalance.parentElement.style.display = 'block';
        } else {
            el.walletBalance.parentElement.style.display = 'none';
        }

        avatar.textContent = initials;
        nameEl.textContent = displayName;
        roleEl.textContent = displayRole;
    }

    // ==========================================
    // STUDENT INTERFACES
    // ==========================================
    function renderStudentDashboard() {
        el.viewportTitle.textContent = "CANDIDATE TELEMETRY & COMMAND PANEL";
        
        // List Exams
        const exams = DB.getExams();
        el.availableExamsList.innerHTML = '';
        
        exams.forEach(exam => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 16px; font-family: 'JetBrains Mono', monospace; font-size: 13px;">${exam.course}</td>
                <td style="padding: 16px; font-weight: 600;">${exam.title}</td>
                <td style="padding: 16px; color: var(--text-secondary);">${exam.duration} Minutes</td>
                <td style="padding: 16px;">
                    <span class="report-status-badge secure">READY</span>
                </td>
                <td style="padding: 16px; text-align: right;">
                    <button onclick="startStudentExam('${exam.id}')" class="btn-premium btn-outline" style="padding: 8px 16px; width: auto; font-size: 11px;">LAUNCH INITIALIZATION</button>
                </td>
            `;
            el.availableExamsList.appendChild(tr);
        });

        // Load warnings state
        const state = DB.getStudentState(AppState.currentUser);
        document.getElementById('student-dashboard-warnings').textContent = state.warnings;
        document.getElementById('student-dashboard-risk').textContent = state.riskScore + '%';
    }

    window.startStudentExam = function(examId) {
        const exam = DB.getExams().find(e => e.id === examId);
        if (!exam) return;

        AppState.currentExam = exam;
        AppState.remainingTime = exam.duration * 60;
        AppState.currentQuestionIndex = 0;
        AppState.examAnswers = {};
        AppState.bookmarkedQuestions.clear();

        // Turn on Proctoring
        Proctor.start(AppState.currentUser);
        showView('exam');
    };

    // ==========================================
    // EXAM ENGINE WORKSPACE
    // ==========================================
    function renderExamWorkspace() {
        const exam = AppState.currentExam;
        document.getElementById('exam-title-header').textContent = exam.title;
        document.getElementById('exam-duration-badge').textContent = `TIME REMAINING: ${formatTime(AppState.remainingTime)}`;
        
        // Setup timer interval
        if (AppState.examTimerInterval) clearInterval(AppState.examTimerInterval);
        AppState.examTimerInterval = setInterval(() => {
            AppState.remainingTime--;
            document.getElementById('exam-duration-badge').textContent = `TIME REMAINING: ${formatTime(AppState.remainingTime)}`;
            
            if (AppState.remainingTime <= 0) {
                clearInterval(AppState.examTimerInterval);
                submitExamSession();
            }
        }, 1000);

        // Telemetry draw loop
        const telemetryCanvas = document.getElementById('exam-telemetry-canvas');
        if (AppState.telemetryLoop) clearInterval(AppState.telemetryLoop);
        
        AppState.telemetryLoop = setInterval(() => {
            Proctor.drawTelemetry(telemetryCanvas, false, null);
            syncDynamicVignetteAndWarnings();
        }, 100);

        // Build Question Navigate Grid
        const gridBox = document.getElementById('exam-nav-grid');
        gridBox.innerHTML = '';
        exam.questions.forEach((q, index) => {
            const btn = document.createElement('button');
            btn.className = `q-grid-btn ${index === AppState.currentQuestionIndex ? 'active' : ''}`;
            btn.textContent = index + 1;
            btn.onclick = () => {
                AppState.currentQuestionIndex = index;
                renderActiveQuestion();
            };
            gridBox.appendChild(btn);
        });

        renderActiveQuestion();
    }

    function renderActiveQuestion() {
        const exam = AppState.currentExam;
        const q = exam.questions[AppState.currentQuestionIndex];
        const bodyEl = document.getElementById('exam-question-body');

        // Update active grid button
        const buttons = document.querySelectorAll('#exam-nav-grid .q-grid-btn');
        buttons.forEach((btn, index) => {
            btn.className = 'q-grid-btn';
            if (index === AppState.currentQuestionIndex) btn.classList.add('active');
            if (AppState.examAnswers[exam.questions[index].id]) btn.classList.add('answered');
            if (AppState.bookmarkedQuestions.has(exam.questions[index].id)) btn.classList.add('bookmarked');
        });

        // Question Details
        document.getElementById('exam-question-num-title').textContent = `QUESTION ${AppState.currentQuestionIndex + 1} OF ${exam.questions.length}`;
        document.getElementById('exam-question-text').textContent = q.text;

        // Render Answer Controls depending on type
        bodyEl.innerHTML = '';

        if (q.type === 'objective') {
            const optsContainer = document.createElement('div');
            optsContainer.style.display = 'flex';
            optsContainer.style.flexDirection = 'column';
            optsContainer.style.gap = '12px';
            optsContainer.style.marginTop = '20px';

            q.options.forEach((opt, idx) => {
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '12px';
                label.style.border = '1px solid var(--border-color)';
                label.style.padding = '16px';
                label.style.cursor = 'pointer';
                label.style.fontSize = '13px';
                label.style.fontFamily = 'Inter, sans-serif';
                label.style.background = AppState.examAnswers[q.id] === idx ? 'rgba(197, 168, 128, 0.05)' : 'transparent';
                label.style.borderColor = AppState.examAnswers[q.id] === idx ? 'var(--gold-accent)' : 'var(--border-color)';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `opt-${q.id}`;
                radio.value = idx;
                radio.style.width = 'auto';
                radio.checked = AppState.examAnswers[q.id] === idx;
                radio.onchange = () => {
                    saveExamAnswer(q.id, idx);
                    renderActiveQuestion();
                };

                label.appendChild(radio);
                label.appendChild(document.createTextNode(opt));
                optsContainer.appendChild(label);
            });
            bodyEl.appendChild(optsContainer);

        } else if (q.type === 'subjective') {
            const area = document.createElement('textarea');
            area.className = 'code-textarea';
            area.placeholder = 'Provide analytical response here... (autosave active)';
            area.style.color = 'var(--text-primary)';
            area.value = AppState.examAnswers[q.id] || '';
            
            // Listen for input and save
            area.oninput = (e) => {
                saveExamAnswer(q.id, e.target.value);
            };
            
            bodyEl.appendChild(area);

        } else if (q.type === 'practical') {
            const codeWrap = document.createElement('div');
            codeWrap.className = 'coding-workspace';
            
            codeWrap.innerHTML = `
                <div class="code-editor-header">
                    <span class="editor-lang-label">JAVASCRIPT SANDBOX</span>
                    <button onclick="runSimulatedCompiler()" class="btn-premium" style="width:auto; padding: 6px 12px; font-size:10px;">RUN TEST SUITE</button>
                </div>
                <textarea id="exam-coding-textarea" class="code-textarea">${AppState.examAnswers[q.id] || q.starterCode}</textarea>
                <div id="compiler-output" class="compiler-output-box">> Terminal listening for build execution...</div>
            `;
            
            bodyEl.appendChild(codeWrap);

            // Bind input event to save code answers
            const txt = document.getElementById('exam-coding-textarea');
            txt.oninput = (e) => {
                saveExamAnswer(q.id, e.target.value);
            };
        }

        // Bookmark status
        const bookmarkBtn = document.getElementById('btn-bookmark-toggle');
        if (AppState.bookmarkedQuestions.has(q.id)) {
            bookmarkBtn.textContent = "BOOKMARKED ✓";
            bookmarkBtn.classList.add('active');
        } else {
            bookmarkBtn.textContent = "BOOKMARK QUESTION";
            bookmarkBtn.classList.remove('active');
        }
    }

    function saveExamAnswer(qId, val) {
        if (!AppState.isOnline) {
            // Queue offline for sync
            DB.addToOfflineQueue(AppState.currentExam.id, qId, val, new Date().toISOString());
        } else {
            AppState.examAnswers[qId] = val;
        }
        
        // Auto-save message in console
        console.log(`Saved answer for ${qId} -> ${val}`);
    }

    window.toggleQuestionBookmark = function() {
        const qId = AppState.currentExam.questions[AppState.currentQuestionIndex].id;
        if (AppState.bookmarkedQuestions.has(qId)) {
            AppState.bookmarkedQuestions.delete(qId);
        } else {
            AppState.bookmarkedQuestions.add(qId);
        }
        renderActiveQuestion();
    };

    window.navNextQuestion = function() {
        const exam = AppState.currentExam;
        if (AppState.currentQuestionIndex < exam.questions.length - 1) {
            AppState.currentQuestionIndex++;
            renderActiveQuestion();
        }
    };

    window.navPrevQuestion = function() {
        if (AppState.currentQuestionIndex > 0) {
            AppState.currentQuestionIndex--;
            renderActiveQuestion();
        }
    };

    // Math Calculator Toggle
    window.toggleMathCalculator = function() {
        const calc = document.getElementById('calculator-overlay');
        calc.style.display = calc.style.display === 'flex' ? 'none' : 'flex';
    };

    window.calcKeyPress = function(key) {
        const screen = document.getElementById('calc-screen');
        if (key === 'C') {
            screen.value = '';
        } else if (key === '=') {
            try {
                // Evaluates simple expressions securely
                screen.value = eval(screen.value.replace(/[^0-9+\-*/.]/g, ''));
            } catch (err) {
                screen.value = 'ERROR';
            }
        } else {
            screen.value += key;
        }
    };

    // Simulated Code Compiler
    window.runSimulatedCompiler = function() {
        const compilerOutput = document.getElementById('compiler-output');
        compilerOutput.innerHTML = "> Compiling secure execution runtime...<br>";
        
        setTimeout(() => {
            compilerOutput.innerHTML += "> Spawning isolate container...<br>";
            setTimeout(() => {
                compilerOutput.innerHTML += `<span style="color:#a8ff60">> Execution Succeeded.</span><br>`;
                compilerOutput.innerHTML += `[PASS] Test Case 1: assert prevHash linkage validated.<br>`;
                compilerOutput.innerHTML += `[PASS] Test Case 2: assert checkBlockIntegrity correct output.<br>`;
                compilerOutput.innerHTML += `[PASS] Test Case 3: Performance test completed under 12ms.`;
            }, 800);
        }, 500);
    };

    // Alert system responses and screen blurs
    function syncDynamicVignetteAndWarnings() {
        const docRoot = document.documentElement;
        
        // Unique Visual Security blur filter values based on proctor flags
        if (Proctor.simulatingState !== 'normal') {
            docRoot.style.setProperty('--focus-blur-amount', '8px');
            docRoot.style.setProperty('--vignette-opacity', '0.85');
            document.getElementById('exam-workspace-main').classList.add('exam-blurred-container');
            document.getElementById('proctor-warning-overlay').style.display = 'flex';
        } else {
            docRoot.style.setProperty('--focus-blur-amount', '0px');
            docRoot.style.setProperty('--vignette-opacity', '0.15');
            document.getElementById('exam-workspace-main').classList.remove('exam-blurred-container');
            document.getElementById('proctor-warning-overlay').style.display = 'none';
        }
        
        // Alerts Feed
        const alertFeed = document.getElementById('exam-proctor-alerts-feed');
        alertFeed.innerHTML = '';
        Proctor.anomalyLogs.slice(0, 10).forEach(anom => {
            const div = document.createElement('div');
            div.className = 'proctor-alert-item';
            div.innerHTML = `
                <div class="proctor-alert-time">${formatTime(new Date(anom.timestamp).getSeconds())} sec ago</div>
                <div class="proctor-alert-text">[${anom.type}] - ${JSON.stringify(anom.payload)}</div>
            `;
            alertFeed.appendChild(div);
        });

        // Warnings Count
        document.getElementById('exam-warning-badge').textContent = `SYSTEM WARNINGS: ${Proctor.warningCount}`;
    }

    // Submit Exam
    window.submitExamSession = function() {
        Proctor.stop();
        if (AppState.telemetryLoop) clearInterval(AppState.telemetryLoop);
        if (AppState.examTimerInterval) clearInterval(AppState.examTimerInterval);
        
        showWarningFlash('Submitting', 'Finalizing block check verification...');
        
        setTimeout(() => {
            showView('student');
            showWarningFlash('Success', 'Exam results pushed to proctor validation chain.');
        }, 1200);
    };

    // Proctor Tester Switch (Student simulation triggers)
    window.triggerSimState = function(stateName) {
        Proctor.simulatingState = stateName;
        // Update simulation panel buttons active state
        document.querySelectorAll('.btn-sim').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick').includes(stateName)) {
                btn.classList.add('active');
            }
        });
    };

    // ==========================================
    // PROFESSOR PANEL CONTROLLERS
    // ==========================================
    function renderProfessorDashboard() {
        el.viewportTitle.textContent = "PROCTOR CONTROL COMMAND & SCHEDULING";
        
        // Monitoring view rendering
        const streamGrid = el.profMonitoringGrid;
        streamGrid.innerHTML = '';

        // Standard student list rendering
        const email = 'student@nexus.edu';
        const stState = DB.getStudentState(email);
        
        const card = document.createElement('div');
        card.className = `student-camera-card ${stState.warnings > 0 ? 'flagged' : ''}`;
        
        card.innerHTML = `
            <canvas class="student-camera-canvas" id="prof-mon-canvas-${email.replace('@','-')}"></canvas>
            <div class="student-card-details">
                <div class="student-card-name">Kaelen Vance</div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-secondary); margin-top:2px;">EMAIL: ${email}</div>
                <div class="student-card-metrics">
                    <div style="color: ${stState.riskScore > 30 ? 'var(--alert-danger)' : 'var(--gold-accent)'}">AI RISK: ${stState.riskScore}%</div>
                    <div>WARNINGS: ${stState.warnings}</div>
                </div>
                <div style="margin-top: 12px; display: flex; gap: 6px;">
                    <button onclick="profTriggerAction('${email}', 'warn')" class="btn-premium" style="font-size: 9px; padding: 6px; flex: 1;">WARN</button>
                    <button onclick="profTriggerAction('${email}', 'sync')" class="btn-premium btn-outline" style="font-size: 9px; padding: 6px; flex: 1;">FORCE SYNC</button>
                </div>
            </div>
        `;
        streamGrid.appendChild(card);

        // Update webcam render canvas inside monitoring frame
        setTimeout(() => {
            const cv = document.getElementById(`prof-mon-canvas-${email.replace('@','-')}`);
            if (cv) {
                // Draw telemetry onto prof card
                Proctor.drawTelemetry(cv, false, null);
            }
        }, 100);

        // Wallet Balance Updates
        el.walletBalance.textContent = AppState.walletCredits;

        // Render logs
        renderCryptographicLogs();
    }

    window.profTriggerAction = function(email, action) {
        if (action === 'warn') {
            Proctor.handleAnomaly('PROFESSOR_ISSUED_WARNING', { issuer: 'Dr. Evelyn Croft', detail: 'Direct warning issued due to suspicious motion' }, 10);
            showWarningFlash('Warning Issued', `A proctor alert has been pushed to student terminal ${email}.`);
            renderProfessorDashboard();
        } else if (action === 'sync') {
            triggerOfflineQueueSync();
        }
    };

    // AI Assisted Question Generator (Wallet credits deduction)
    window.triggerAIQuestionGen = function() {
        if (AppState.walletCredits < 500) {
            showWarningFlash('Insufficient Funds', 'AI Compute Wallet has run out of tokens. Purchase additional credits.');
            return;
        }

        AppState.walletCredits = DB.deductWallet(500);
        
        // Append randomized AI questions to database structure
        const exams = DB.getExams();
        const templates = [
            {
                type: 'objective',
                text: 'Explain the effect of Kernel Page-Table Isolation (KPTI) on performance profiling during continuous keyboard monitoring telemetry.',
                options: ['Zero overhead', 'Microsecond execution delays', 'Memory leak amplification', 'Complete kernel crash'],
                answer: 1
            },
            {
                type: 'objective',
                text: 'Which convolutional filter structure maximizes the contrast detection of gaze shifts in low-light environments?',
                options: ['Gaussian blur filter', 'Sobel gradient matrices', 'Haar-cascade integral images', 'Bilateral illumination maps'],
                answer: 2
            }
        ];

        const selectQ = templates[Math.floor(Math.random() * templates.length)];
        exams[0].questions.push(selectQ);
        DB.saveExams(exams);
        
        renderProfessorDashboard();
        showWarningFlash('AI Generated Question', 'Question generated successfully. 500 credits deducted from proctor wallet.');
    };

    // Render Cryptographic Blockchain Ledger Logs
    function renderCryptographicLogs() {
        const table = el.blockchainLogsTable;
        table.innerHTML = '';
        
        const logs = DB.logs.getLogs();
        logs.slice().reverse().forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">#${log.index}</td>
                <td style="padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">${log.eventType}</td>
                <td style="padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--gold-accent);">${log.hash.substring(0, 16)}...</td>
                <td style="padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-secondary);">${log.prevHash.substring(0, 16)}...</td>
                <td style="padding: 12px;">
                    <span class="report-status-badge secure" id="log-status-badge-${log.index}">SECURE</span>
                </td>
            `;
            table.appendChild(tr);
        });
    }

    // Ledger Chaining verification
    window.verifyBlockchainIntegrity = async function() {
        showWarningFlash('Auditing Blockchain', 'Re-hashing SHA-256 links and asserting tamper checks...');
        
        const results = await DB.logs.verifyChainIntegrity();
        setTimeout(() => {
            if (results.overallValid) {
                showWarningFlash('Verified', 'Ledger remains clean. Zero modified signatures detected.');
            } else {
                showWarningFlash('CORRUPT LEDGER', 'Alert: Cryptographic proof of tampering identified in append-only files.');
            }

            // Update row highlights
            results.chain.forEach(res => {
                const badge = document.getElementById(`log-status-badge-${res.index}`);
                if (badge) {
                    if (res.isValid) {
                        badge.textContent = "SECURE";
                        badge.className = "report-status-badge secure";
                    } else {
                        badge.textContent = "TAMPERED";
                        badge.className = "report-status-badge compromised";
                    }
                }
            });
        }, 1200);
    };

    // Simulation Attack injector
    window.injectSimulatedTamper = async function() {
        const logs = DB.logs.getLogs();
        if (logs.length > 0) {
            const indexToCorrupt = Math.floor(Math.random() * logs.length);
            await DB.logs.injectMaliciousMod(indexToCorrupt, "Payload injected by VM screen share simulator");
            showWarningFlash('Tamper Injected', `Modified payload at log index #${indexToCorrupt} directly in local database representation. Run verification to test integrity detection.`);
            renderProfessorDashboard();
        } else {
            showWarningFlash('Empty Logs', 'Generate some proctor events first by taking an exam or issue warnings.');
        }
    };

    // ==========================================
    // ADMIN DASHBOARD CONTROLLERS
    // ==========================================
    function renderAdminDashboard() {
        el.viewportTitle.textContent = "CYBER INTEGRITY AUDIT WORKSPACE";
        
        const explanation = Proctor.explainRisk();
        document.getElementById('admin-explainable-summary').textContent = explanation.summary;
        
        const list = document.getElementById('admin-explainable-factors');
        list.innerHTML = '';
        explanation.factors.forEach(fac => {
            const li = document.createElement('li');
            li.style.fontFamily = 'JetBrains Mono', 'monospace';
            li.style.fontSize = '12px';
            li.style.marginBottom = '8px';
            li.style.color = 'var(--text-primary)';
            li.innerHTML = `<span style="color:var(--gold-accent)">${fac.name}</span>: ${fac.count || fac.value} (${fac.weight || 'Baseline'})`;
            list.appendChild(li);
        });

        // Typing Pattern Cadence Heatmap renders
        const keysContainer = document.getElementById('admin-typing-heatmap');
        keysContainer.innerHTML = '';
        const mockKeys = ['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L',';','Z','X','C','V','B','N','M',',','.','/'];
        
        mockKeys.forEach(k => {
            const keyEl = document.createElement('div');
            keyEl.className = 'heatmap-key';
            keyEl.textContent = k;
            
            // Randomly highlight key intensives for visualization
            const weight = Math.floor(Math.random() * 4);
            if (weight > 0) {
                keyEl.classList.add(`intensity-${weight}`);
            }
            keysContainer.appendChild(keyEl);
        });

        document.getElementById('admin-humanity-score').textContent = `${Proctor.typingPatternHumanity}% Match`;
    }

    // Utility tools
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // Initial View setup
    showView('login');
});
