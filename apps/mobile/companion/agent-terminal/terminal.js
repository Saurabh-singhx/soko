/**
 * ==============================================================================
 * SOKO AGENT REMOTE TERMINAL LOGIC & WEBSOCKET ENGINE
 * Real-time event streaming, session switching, and prompt turn dispatching.
 * ==============================================================================
 */

(function (window) {
  'use strict';

  const AgentTerminal = {
    currentSessionId: null,
    allSessions: [],
    recentSessions: [],
    activeSessions: [],
    currentIndex: 0,
    pageSize: 5,
    currentPage: 1,
    turns: [],
    isWorking: false,
    isWaiting: false,
    cursor: 0,
    isPreviewMode: false,

    init() {
      console.log('[Agent Terminal] Initializing remote agent subsystem...');
      this.bindDOMElements();
      this.attachEventListeners();

      // Only enter preview mode if EXPLICITLY requested via query params and NOT in native APK WebView
      const urlParams = new URLSearchParams(window.location.search);
      const isExplicitPreview = (urlParams.get('preview') === '1' || urlParams.get('mock') === '1') && !window.SokoNative;
      if (isExplicitPreview) {
        this.isPreviewMode = true;
        this.loadPreviewState();
        return;
      }

      this.isPreviewMode = false;
      this.renderEmptyState('Connecting to agent session...');

      // If WebSocket already connected, fetch initial sessions
      if (typeof window.sendPacket === 'function') {
        this.fetchSessions();
      }
    },

    loadPreviewState() {
      const urlParams = new URLSearchParams(window.location.search);
      const isBigText = urlParams.get('bigtext') === '1' || urlParams.get('stress') === '1';

      this.currentSessionId = 'preview_conv_1';
      const now = Date.now();

      this.allSessions = [
        {
          sessionId: 'preview_conv_1',
          name: 'Soko Cockpit',
          workspaceName: 'soko',
          status: 'working',
          mtimeMs: now - 15000,
          tokensUsed: isBigText ? 1845920 : 137125,
          taskSummary: 'Refactoring concurrent transfer protocol and responsive viewports for mobile devices',
        },
        {
          sessionId: 'preview_conv_2',
          name: 'Soko Cockpit',
          workspaceName: 'soko',
          status: 'active',
          mtimeMs: now - 720000,
          tokensUsed: 89400,
          taskSummary: 'Build and verify production Android APK packages',
        },
        {
          sessionId: 'preview_conv_3',
          name: 'Soko Cockpit',
          workspaceName: 'soko',
          status: 'idle',
          mtimeMs: now - 3600000,
          tokensUsed: 42100,
          taskSummary: 'Run full unit test suite and mobile audit checks',
        },
        {
          sessionId: 'preview_conv_4',
          name: 'Soko Cockpit',
          workspaceName: 'soko',
          status: 'idle',
          mtimeMs: now - 86400000,
          tokensUsed: 65200,
          taskSummary: 'Verify pairing and QR code key exchange',
        },
        {
          sessionId: 'preview_conv_5',
          name: 'Soko Cockpit',
          workspaceName: 'soko',
          status: 'idle',
          mtimeMs: now - 172800000,
          tokensUsed: 19800,
          taskSummary: 'Configure responsive navigation dock',
        },
      ];
      this.activeSessions = this.allSessions;
      this.currentPage = 1;
      this.slicePageSessions();

      this.isWorking = true;
      this.setMascotState('working');

      if (this.headerAppTitle) this.headerAppTitle.textContent = 'Soko Cockpit';
      if (this.headerSubtitle) {
        this.headerSubtitle.textContent = '137,125 tokens • Refactoring concurrent transfer...';
      }

      this.turns = [
        {
          id: 'turn-1',
          stepIndex: 1,
          timestamp: now - 45000,
          userInput: 'Check current test suite and enable live terminal mirroring on mobile companion',
          thinking: [
            'Inspecting active session transcripts and verifying WebSocket connection...',
            'Stream pipeline calibrated with live delta turn processing.',
          ],
          toolCalls: [
            {
              name: 'run_command',
              summary: 'npm test',
            },
            {
              name: 'edit_file',
              summary: 'Edit configuration settings',
            },
          ],
          responses: [
            'All integration tests passed. Live transcript streaming and turn queueing are active.',
          ],
        },
      ];

      this.renderFeed();
      this.updatePaginationUI();
    },

    bindDOMElements() {
      this.feedScroll = document.getElementById('agentFeedScroll');
      this.sessionSelect = document.getElementById('agentSessionSelect');
      this.sessionInfoBtn = document.getElementById('agentSessionInfoBtn');
      this.paginationBar = document.getElementById('agentPaginationBar');
      this.pagPrevBtn = document.getElementById('pagPrevBtn');
      this.pagNextBtn = document.getElementById('pagNextBtn');
      this.pagCenter = document.getElementById('pagCenter');
      this.pagLabel = document.getElementById('pagLabel');
      this.pagStatus = document.getElementById('pagStatus');
      this.sessionModal = document.getElementById('sessionDetailsModal');
      this.sessionModalClose = document.getElementById('sessionDetailsCloseBtn');
      this.sessionModalCopy = document.getElementById('modalCopySessionIdBtn');
      this.mascotBot = document.getElementById('mascotBot');
      this.headerAppTitle = document.getElementById('headerAppTitle');
      this.headerSubtitle = document.getElementById('headerSubtitle');
      this.promptInput = document.getElementById('agentPromptInput');
      this.sendBtn = document.getElementById('agentSendBtn');
      this.exitBtn = document.getElementById('agentExitBtn');
    },

    setMascotState(state) {
      if (!this.mascotBot) this.mascotBot = document.getElementById('mascotBot');
      if (this.mascotBot) {
        this.mascotBot.classList.remove('state-working', 'state-waiting', 'state-idle', 'state-offline');
        if (state) {
          this.mascotBot.classList.add(`state-${state}`);
        }
      }
    },

    attachEventListeners() {
      if (this.sendBtn) {
        this.sendBtn.addEventListener('click', () => this.handleSend());
      }

      if (this.promptInput) {
        this.promptInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSend();
          }
        });
      }

      if (this.exitBtn) {
        this.exitBtn.addEventListener('click', () => {
          if (typeof window.exitTerminalMode === 'function') {
            window.exitTerminalMode();
          }
        });
      }

      if (this.sessionSelect) {
        this.sessionSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val === '__PAGE_PREV__') {
            this.currentPage = Math.max(1, this.currentPage - 1);
            this.slicePageSessions();
            if (this.recentSessions[0]) this.switchSession(this.recentSessions[0].sessionId);
            return;
          }
          if (val === '__PAGE_NEXT__') {
            this.currentPage++;
            this.slicePageSessions();
            if (this.recentSessions[0]) this.switchSession(this.recentSessions[0].sessionId);
            return;
          }
          if (val && val !== this.currentSessionId) {
            this.switchSession(val);
          }
        });
      }

      if (this.pagPrevBtn) {
        this.pagPrevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.goToPrevConversation();
        });
      }

      if (this.pagNextBtn) {
        this.pagNextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.goToNextConversation();
        });
      }

      if (this.pagCenter) {
        this.pagCenter.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openSessionDetails();
        });
      }

      if (this.sessionInfoBtn) {
        this.sessionInfoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openSessionDetails();
        });
      }

      if (this.sessionModalClose) {
        this.sessionModalClose.addEventListener('click', () => {
          this.closeSessionDetails();
        });
      }

      if (this.sessionModal) {
        this.sessionModal.addEventListener('click', (e) => {
          if (e.target === this.sessionModal) {
            this.closeSessionDetails();
          }
        });
      }

      if (this.sessionModalCopy) {
        this.sessionModalCopy.addEventListener('click', () => {
          this.copySessionId();
        });
      }

      if (this.headerAppTitle) {
        this.headerAppTitle.addEventListener('click', () => {
          if (document.getElementById('tab-cli')?.classList.contains('active')) {
            this.openSessionDetails();
          }
        });
      }
    },

    /**
     * Called whenever user switches to the Terminal tab.
     */
    onTabActivated() {
      this.bindDOMElements();
      if (this.currentSessionId) {
        const active = (this.allSessions && this.allSessions.find((s) => s.sessionId === this.currentSessionId)) ||
                       (this.recentSessions && this.recentSessions.find((s) => s.sessionId === this.currentSessionId));
        if (active) {
          if (this.headerAppTitle) this.headerAppTitle.textContent = active.workspaceName || 'Soko Cockpit';
          if (this.headerSubtitle) {
            const rawTask = active.taskSummary || 'Conversation active';
            const capped = rawTask.length > 36 ? `${rawTask.slice(0, 35)}…` : rawTask;
            const tokens = active.tokensUsed ? `${active.tokensUsed.toLocaleString()} tokens • ` : '';
            this.headerSubtitle.textContent = `${tokens}${capped}`;
            this.headerSubtitle.title = `${tokens}${rawTask}`;
          }
        }
        this.updatePaginationUI();
      }
      if (this.isPreviewMode) {
        setTimeout(() => this.scrollToBottom(), 100);
        return;
      }
      this.fetchSessions();
      if (this.currentSessionId) {
        if (typeof window.sendPacket === 'function') {
          window.sendPacket('AGENT_SUBSCRIBE_SESSION', { sessionId: this.currentSessionId });
        }
        this.syncCurrentSession();
      }
      setTimeout(() => this.scrollToBottom(), 100);
    },

    /**
     * Called whenever WebSocket connection is established or re-authenticated.
     */
    onWsConnected() {
      this.fetchSessions();
      if (this.currentSessionId && typeof window.sendPacket === 'function') {
        window.sendPacket('AGENT_SUBSCRIBE_SESSION', { sessionId: this.currentSessionId });
      }
    },

    /**
     * Query active sessions from Soko Bridge daemon.
     */
    fetchSessions() {
      if (typeof window.sendPacket === 'function') {
        window.sendPacket('FETCH_AGENT_SESSIONS', {});
      } else if (typeof window.postHttp === 'function') {
        window.postHttp('/api/agent/sessions', {}).then((res) => {
          if (res && res.sessions) {
            this.updateSessionList(res.sessions);
          }
        });
      }
    },

    /**
     * Updates session switcher options with last 5 recent conversations and pagination.
     */
    updateSessionList(sessions) {
      if (!Array.isArray(sessions)) return;
      this.allSessions = sessions.sort((a, b) => (Number(b.mtimeMs) || 0) - (Number(a.mtimeMs) || 0));
      this.activeSessions = this.allSessions;
      this.slicePageSessions();

      if (this.recentSessions.length === 0) {
        if (this.sessionSelect) {
          this.sessionSelect.innerHTML = '<option value="">No conversations</option>';
        }
        if (this.paginationBar) this.paginationBar.style.display = 'none';
        if (this.turns.length === 0) {
          this.renderEmptyState('No active agent conversations detected. Start a task on your PC to mirror live here.');
        }
        return;
      }

      // Auto-select first active or working session
      if (!this.currentSessionId || !this.allSessions.some((s) => s.sessionId === this.currentSessionId)) {
        const preferred = this.recentSessions.find((s) => s.status === 'working' || s.isLocked) || this.recentSessions[0];
        if (preferred) {
          this.switchSession(preferred.sessionId);
        }
      } else {
        if (this.sessionSelect) this.sessionSelect.value = this.currentSessionId;
        this.updatePaginationUI();
      }
    },

    slicePageSessions() {
      const start = (this.currentPage - 1) * this.pageSize;
      this.recentSessions = this.allSessions.slice(start, start + this.pageSize);
      this.renderSessionSelectOptions();
    },

    renderSessionSelectOptions() {
      if (!this.sessionSelect) this.sessionSelect = document.getElementById('agentSessionSelect');
      if (!this.sessionSelect) return;
      this.sessionSelect.innerHTML = '';

      if (this.currentPage > 1) {
        const optPrev = document.createElement('option');
        optPrev.value = '__PAGE_PREV__';
        optPrev.textContent = `◀ Newer (Page ${this.currentPage - 1})`;
        this.sessionSelect.appendChild(optPrev);
      }

      this.recentSessions.forEach((s, idx) => {
        const convNum = (this.currentPage - 1) * this.pageSize + idx + 1;
        const opt = document.createElement('option');
        opt.value = s.sessionId;
        const timeLabel = s.status === 'working'
          ? '⚡ Active'
          : (s.status === 'waiting' ? '⏳ Waiting' : this.formatRelativeTime(s.mtimeMs));
        opt.textContent = `Conv ${convNum} • ${timeLabel}`;
        this.sessionSelect.appendChild(opt);
      });

      if (this.currentPage * this.pageSize < this.allSessions.length) {
        const optNext = document.createElement('option');
        optNext.value = '__PAGE_NEXT__';
        optNext.textContent = `▶ Older (Page ${this.currentPage + 1})`;
        this.sessionSelect.appendChild(optNext);
      }

      if (this.currentSessionId) {
        this.sessionSelect.value = this.currentSessionId;
      }
      this.updatePaginationUI();
    },

    updatePaginationUI() {
      if (!this.paginationBar) this.paginationBar = document.getElementById('agentPaginationBar');
      if (!this.paginationBar) return;

      const total = this.recentSessions.length;
      if (total === 0) {
        this.paginationBar.style.display = 'none';
        return;
      }
      this.paginationBar.style.display = 'flex';

      const currentIdx = this.recentSessions.findIndex((s) => s.sessionId === this.currentSessionId);
      const activeIdx = currentIdx >= 0 ? currentIdx : 0;
      const convNum = (this.currentPage - 1) * this.pageSize + activeIdx + 1;
      const totalAvailable = this.allSessions.length || total;

      if (!this.pagLabel) this.pagLabel = document.getElementById('pagLabel');
      if (this.pagLabel) {
        this.pagLabel.textContent = `Conversation ${convNum} of ${totalAvailable}`;
      }

      if (!this.pagStatus) this.pagStatus = document.getElementById('pagStatus');
      const active = this.recentSessions[activeIdx];
      if (this.pagStatus && active) {
        const timeText = active.status === 'working'
          ? '⚡ Active now'
          : (active.status === 'waiting' ? '⏳ Waiting' : this.formatRelativeTime(active.mtimeMs));
        this.pagStatus.textContent = timeText;
      }

      if (!this.pagPrevBtn) this.pagPrevBtn = document.getElementById('pagPrevBtn');
      if (this.pagPrevBtn) {
        const canPrev = activeIdx > 0 || this.currentPage > 1;
        this.pagPrevBtn.disabled = !canPrev;
        this.pagPrevBtn.classList.toggle('disabled', !canPrev);
      }

      if (!this.pagNextBtn) this.pagNextBtn = document.getElementById('pagNextBtn');
      if (this.pagNextBtn) {
        const canNext = activeIdx < total - 1 || (this.currentPage * this.pageSize < this.allSessions.length);
        this.pagNextBtn.disabled = !canNext;
        this.pagNextBtn.classList.toggle('disabled', !canNext);
      }
    },

    goToPrevConversation() {
      const currentIdx = this.recentSessions.findIndex((s) => s.sessionId === this.currentSessionId);
      if (currentIdx > 0) {
        const prevSession = this.recentSessions[currentIdx - 1];
        this.switchSession(prevSession.sessionId);
      } else if (this.currentPage > 1) {
        this.currentPage--;
        this.slicePageSessions();
        const lastSession = this.recentSessions[this.recentSessions.length - 1];
        if (lastSession) this.switchSession(lastSession.sessionId);
      }
    },

    goToNextConversation() {
      const currentIdx = this.recentSessions.findIndex((s) => s.sessionId === this.currentSessionId);
      if (currentIdx >= 0 && currentIdx < this.recentSessions.length - 1) {
        const nextSession = this.recentSessions[currentIdx + 1];
        this.switchSession(nextSession.sessionId);
      } else if (this.currentPage * this.pageSize < this.allSessions.length) {
        this.currentPage++;
        this.slicePageSessions();
        const firstSession = this.recentSessions[0];
        if (firstSession) this.switchSession(firstSession.sessionId);
      }
    },

    formatRelativeTime(mtimeMs) {
      if (!mtimeMs) return 'Recent';
      const diffSec = Math.max(0, Math.floor((Date.now() - Number(mtimeMs)) / 1000));
      if (diffSec < 60) return 'Active now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      const days = Math.floor(diffSec / 86400);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return `${days}d ago`;
    },

    /**
     * Switches feed to view target session ID.
     */
    switchSession(sessionId) {
      if (!sessionId) return;
      this.currentSessionId = sessionId;

      // Ensure current session is on the active page
      const currentIdx = this.recentSessions.findIndex((s) => s.sessionId === sessionId);
      if (currentIdx === -1 && this.allSessions.length > 0) {
        const allIdx = this.allSessions.findIndex((s) => s.sessionId === sessionId);
        if (allIdx >= 0) {
          this.currentPage = Math.floor(allIdx / this.pageSize) + 1;
          this.slicePageSessions();
        }
      }

      if (this.sessionSelect) {
        this.sessionSelect.value = sessionId;
      }
      this.updatePaginationUI();

      const activeSession = (this.allSessions && this.allSessions.find((s) => s.sessionId === sessionId)) ||
                            (this.recentSessions && this.recentSessions.find((s) => s.sessionId === sessionId));
      if (activeSession) {
        if (this.headerAppTitle) this.headerAppTitle.textContent = activeSession.workspaceName || 'Soko Cockpit';
        if (this.headerSubtitle) {
          const tokens = activeSession.tokensUsed ? `${activeSession.tokensUsed.toLocaleString()} tokens` : '';
          const rawTask = activeSession.taskSummary || 'Conversation active';
          const task = rawTask.length > 36 ? `${rawTask.slice(0, 35)}…` : rawTask;
          this.headerSubtitle.textContent = [tokens, task].filter(Boolean).join(' • ');
          this.headerSubtitle.title = [tokens, rawTask].filter(Boolean).join(' • ');
        }
      }

      console.log(`[Agent Terminal] Switched to session: ${sessionId}`);
      this.cursor = 0;
      if (!this.isPreviewMode) {
        this.turns = [];
        this.renderLoadingState();
      }

      // Subscribe via WebSocket
      if (typeof window.sendPacket === 'function') {
        window.sendPacket('AGENT_SUBSCRIBE_SESSION', { sessionId });
      }

      this.syncCurrentSession();
    },

    /**
     * Syncs latest transcript turns from bridge daemon.
     */
    syncCurrentSession() {
      if (!this.currentSessionId || this.isPreviewMode) return;

      if (typeof window.sendPacket === 'function') {
        window.sendPacket('AGENT_GET_TRANSCRIPT_HISTORY', { sessionId: this.currentSessionId });
      } else if (typeof window.postHttp === 'function') {
        window.postHttp(`/api/agent/transcript?sessionId=${encodeURIComponent(this.currentSessionId)}&cursor=${this.cursor}`, {
          sessionId: this.currentSessionId,
          cursor: this.cursor,
        }).then((res) => {
          if (res && res.success && Array.isArray(res.turns)) {
            this.handleTranscriptHistory(res);
          }
        }).catch(() => {});
      } else if (typeof fetch === 'function') {
        const base = typeof window.getHttpBaseUrl === 'function' ? window.getHttpBaseUrl() : '';
        if (base) {
          fetch(`${base}/api/agent/transcript?sessionId=${encodeURIComponent(this.currentSessionId)}&cursor=${this.cursor}`)
            .then((r) => r.json())
            .then((res) => {
              if (res && res.success && Array.isArray(res.turns)) {
                this.handleTranscriptHistory(res);
              }
            })
            .catch(() => {});
        }
      }
    },

    /**
     * Handles incoming AGENT_ACTIVITY_STATUS packet broadcast.
     */
    handleActivityStatus(payload) {
      if (!payload) return;

      if (payload.sessionId && !this.currentSessionId) {
        this.currentSessionId = payload.sessionId;
      }

      if (payload.activeSessions && payload.activeSessions.length > 0) {
        this.updateSessionList(payload.activeSessions);
      }

      const isWorking = payload.status === 'working' || payload.status === 'thinking';
      const isWaiting = payload.status === 'waiting';

      this.isWorking = isWorking;
      this.isWaiting = isWaiting;

      this.setMascotState(isWorking ? 'working' : isWaiting ? 'waiting' : 'idle');
      this.updatePaginationUI();

      const isTerminalActive = document.getElementById('tab-cli')?.classList.contains('active');
      if (isTerminalActive) {
        if (this.headerAppTitle) {
          this.headerAppTitle.textContent = payload.workspaceName || 'Soko Cockpit';
        }
        if (this.headerSubtitle) {
          const tokens = payload.tokensUsed ? `${payload.tokensUsed.toLocaleString()} tokens` : '';
          const rawTask = payload.taskSummary || payload.detail || (isWorking ? 'Executing...' : 'Ready');
          const task = rawTask.length > 36 ? `${rawTask.slice(0, 35)}…` : rawTask;
          this.headerSubtitle.textContent = [tokens, task].filter(Boolean).join(' • ');
          this.headerSubtitle.title = [tokens, rawTask].filter(Boolean).join(' • ');
        }
      }
    },

    /**
     * Handles initial full transcript history payload.
     */
    handleTranscriptHistory(data) {
      if (!data || !Array.isArray(data.turns)) return;
      this.cursor = data.cursor || 0;
      this.isWorking = Boolean(data.isWorking);
      this.isWaiting = Boolean(data.isWaiting);

      // Avoid wiping the DOM if turns are unchanged
      if (this.areTurnsEqual(this.turns, data.turns) && this.feedScroll && this.feedScroll.children.length > 0 && !this.feedScroll.querySelector('.feed-empty-state')) {
        return;
      }

      this.turns = data.turns;
      this.renderFeed();
    },

    areTurnsEqual(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      if (a.length === 0) return true;

      const lastA = a[a.length - 1];
      const lastB = b[b.length - 1];
      if (!lastA || !lastB) return false;
      if (lastA.id !== lastB.id || lastA.status !== lastB.status) return false;
      if ((lastA.thinking || []).length !== (lastB.thinking || []).length) return false;
      if ((lastA.toolCalls || []).length !== (lastB.toolCalls || []).length) return false;
      if ((lastA.responses || []).length !== (lastB.responses || []).length) return false;

      return true;
    },

    /**
     * Appends live stream events emitted by the agent in real time.
     * Ingests delta chunks directly with 0ms round-trip lag.
     */
    handleTranscriptChunk(chunk) {
      if (!chunk || chunk.sessionId !== this.currentSessionId) return;

      if (chunk.newCursor) {
        this.cursor = chunk.newCursor;
      }

      if (Array.isArray(chunk.events) && chunk.events.length > 0) {
        let feedNeedsUpdate = false;

        for (const ev of chunk.events) {
          const type = ev.type || '';
          if (type === 'USER_INPUT') {
            const cleanText = this.cleanPromptText(ev.content || '');
            if (cleanText) {
              this.turns.push({
                id: `turn-${ev.step_index || Date.now()}`,
                stepIndex: ev.step_index || 0,
                timestamp: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(),
                userInput: cleanText,
                thinking: [],
                toolCalls: [],
                responses: [],
                status: 'working',
              });
              feedNeedsUpdate = true;
            }
          } else if (this.turns.length > 0) {
            const currentTurn = this.turns[this.turns.length - 1];

            if (ev.thinking) {
              const cleanT = String(ev.thinking).trim();
              if (cleanT && !currentTurn.thinking.includes(cleanT)) {
                currentTurn.thinking.push(cleanT);
                feedNeedsUpdate = true;
              }
            }

            if (ev.tool_calls && Array.isArray(ev.tool_calls)) {
              for (const tc of ev.tool_calls) {
                const summary = tc.args?.CommandLine || tc.args?.Path || tc.args?.toolSummary || tc.name || '';
                const existing = currentTurn.toolCalls.some((t) => t.summary === summary);
                if (!existing) {
                  currentTurn.toolCalls.push({
                    name: tc.name || 'tool',
                    summary: summary,
                  });
                  feedNeedsUpdate = true;
                }
              }
            }

            if (
              ev.content &&
              (type === 'PLANNER_RESPONSE' || type === 'MODEL') &&
              type !== 'GENERIC' &&
              ev.type !== 'GENERIC'
            ) {
              const cleanR = String(ev.content).trim();
              if (
                cleanR &&
                !cleanR.startsWith('<') &&
                !cleanR.includes('vertexaisearch.cloud.google.com') &&
                !cleanR.includes('grounding-api-redirect') &&
                !cleanR.startsWith('Created At:') &&
                !currentTurn.responses.includes(cleanR)
              ) {
                currentTurn.responses.push(cleanR);
                feedNeedsUpdate = true;
              }
            }

            if (ev.status === 'DONE') {
              currentTurn.status = 'completed';
            }
          }
        }

        if (feedNeedsUpdate) {
          this.renderFeed();
        }
      }
    },

    cleanPromptText(text) {
      if (!text) return '';
      let cleaned = String(text);
      const match = cleaned.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
      if (match && match[1]) {
        cleaned = match[1];
      }
      cleaned = cleaned
        .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
        .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
        .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
        .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/The following is a <SYSTEM_MESSAGE>[\s\S]*$/gi, '');
      return cleaned.trim();
    },

    /**
     * Renders all conversational turns into the feed container.
     * Clean, human-readable layout without visual clutter or repetitive icons.
     */
    renderFeed() {
      if (!this.feedScroll) {
        this.feedScroll = document.getElementById('agentFeedScroll');
      }
      if (!this.feedScroll) return;

      if (this.turns.length === 0) {
        this.renderEmptyState('Connected to agent session. No turns recorded yet. Send an instruction below to begin!');
        return;
      }

      this.feedScroll.innerHTML = '';

      this.turns.forEach((turn, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'feed-item';

        // 1. Clean User Prompt Bubble
        const cleanUserText = this.cleanPromptText(turn.userInput);
        if (cleanUserText) {
          const userBubble = document.createElement('div');
          userBubble.className = 'feed-user-msg';
          const timeStr = new Date(turn.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          userBubble.innerHTML = `
            <div class="feed-user-meta">
              <span class="feed-user-label">You</span>
              <span class="feed-msg-time">${timeStr}</span>
            </div>
            <div class="feed-user-text">${this.escapeHtml(cleanUserText)}</div>
          `;
          itemEl.appendChild(userBubble);
        }

        // 2. Visible Agent Thought Process (Normal text, directly readable, no clicking required)
        if (turn.thinking && turn.thinking.length > 0) {
          const thinkingText = Array.isArray(turn.thinking) ? turn.thinking.join('\n\n') : String(turn.thinking);
          const thinkCard = document.createElement('div');
          thinkCard.className = 'feed-thought-card';
          thinkCard.innerHTML = `
            <div class="feed-thought-header">
              <span class="feed-thought-badge">💭 Thought Process</span>
            </div>
            <div class="feed-thought-content">${this.escapeHtml(thinkingText)}</div>
          `;
          itemEl.appendChild(thinkCard);
        }

        // 3. Visible Executed Commands / Actions (Normal text, directly readable, no clicking required)
        if (turn.toolCalls && turn.toolCalls.length > 0) {
          const cmdCard = document.createElement('div');
          cmdCard.className = 'feed-command-card';

          const cmdHeader = document.createElement('div');
          cmdHeader.className = 'feed-command-header';
          cmdHeader.innerHTML = `
            <span class="feed-command-badge">⚡ Action Executed (${turn.toolCalls.length})</span>
          `;
          cmdCard.appendChild(cmdHeader);

          const listEl = document.createElement('div');
          listEl.className = 'feed-command-list';

          turn.toolCalls.forEach((tc) => {
            const line = document.createElement('div');
            line.className = 'feed-command-line';

            let displayCmd = tc.summary || tc.name || '';
            if (tc.name === 'run_command' && !displayCmd.startsWith('$')) {
              displayCmd = `$ ${displayCmd}`;
            }

            line.innerHTML = `
              <span class="feed-command-prefix">&gt;</span>
              <span class="feed-command-text">${this.escapeHtml(displayCmd)}</span>
            `;
            listEl.appendChild(line);
          });

          cmdCard.appendChild(listEl);
          itemEl.appendChild(cmdCard);
        }

        // 4. Agent Responses (Clean markdown-like typography)
        if (turn.responses && turn.responses.length > 0) {
          turn.responses.forEach((resp) => {
            const agentBubble = document.createElement('div');
            agentBubble.className = 'feed-agent-msg';
            agentBubble.innerHTML = `
              <div class="feed-agent-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><rect x="4" y="8" width="16" height="12" rx="2"></rect></svg>
                <span>Antigravity Agent</span>
              </div>
              <div class="feed-agent-text">${this.formatAgentResponse(resp)}</div>
            `;
            itemEl.appendChild(agentBubble);
          });
        }

        this.feedScroll.appendChild(itemEl);
      });

      this.scrollToBottom();
    },

    formatAgentResponse(raw) {
      if (!raw) return '';
      let text = this.escapeHtml(raw);

      // Format code blocks
      text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
      });

      // Format inline code
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Format bold
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      return text;
    },

    renderEmptyState(message) {
      if (!this.feedScroll) return;
      this.feedScroll.innerHTML = `
        <div class="feed-empty-state">
          <div class="empty-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          </div>
          <div class="empty-title">Ready for Remote Commands</div>
          <div class="empty-desc">${this.escapeHtml(message)}</div>
        </div>
      `;
    },

    renderLoadingState() {
      if (!this.feedScroll) return;
      this.feedScroll.innerHTML = `
        <div class="feed-empty-state">
          <div class="empty-icon-wrap" style="animation: pulseWorking 1.2s infinite ease-in-out;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
          </div>
          <div class="empty-title">Syncing Transcript...</div>
          <div class="empty-desc">Loading live session turns from host machine.</div>
        </div>
      `;
    },

    scrollToBottom() {
      if (this.feedScroll) {
        this.feedScroll.scrollTop = this.feedScroll.scrollHeight;
      }
    },

    /**
     * Dispatches user prompt to PC session.
     */
    handleSend() {
      if (!this.promptInput) {
        this.promptInput = document.getElementById('agentPromptInput');
      }
      if (!this.promptInput) return;

      const text = this.promptInput.value.trim();
      if (!text) return;

      if (!this.currentSessionId) {
        if (typeof window.showToast === 'function') {
          window.showToast('No active PC agent session selected.', 'amber');
        }
        return;
      }

      this.sendPrompt(text);
      this.promptInput.value = '';
    },

    sendPrompt(text) {
      console.log(`[Agent Terminal] Dispatching prompt: "${text}" to ${this.currentSessionId}`);

      // Optimistic user turn addition for instantaneous UI response
      this.turns.push({
        id: `turn-local-${Date.now()}`,
        timestamp: Date.now(),
        userInput: text,
        thinking: ['Dispatching prompt to host CLI agent...'],
        toolCalls: [],
        responses: [],
        status: 'working',
      });
      this.renderFeed();

      if (this.sendBtn) {
        this.sendBtn.disabled = true;
      }

      const payload = {
        sessionId: this.currentSessionId,
        prompt: text,
        timestamp: Date.now(),
      };

      const unlockUI = () => {
        if (this.sendBtn) this.sendBtn.disabled = false;
      };

      if (typeof window.sendPacket === 'function') {
        window.sendPacket('AGENT_SEND_PROMPT', payload);
        if (typeof window.showToast === 'function') {
          window.showToast('Instruction sent to agent ✓', 'info');
        }
        setTimeout(() => {
          unlockUI();
          this.syncCurrentSession();
        }, 1200);
      } else if (typeof window.postHttp === 'function') {
        window.postHttp('/api/agent/prompt', payload)
          .then((res) => {
            unlockUI();
            if (typeof window.showToast === 'function') {
              if (res && res.success) {
                window.showToast(res.status === 'queued' ? 'Prompt queued for next turn' : 'Prompt dispatched to agent', 'info');
              } else {
                window.showToast(res?.error || 'Failed to dispatch prompt', 'red');
              }
            }
            setTimeout(() => this.syncCurrentSession(), 1000);
          })
          .catch((err) => {
            unlockUI();
            if (typeof window.showToast === 'function') {
              window.showToast(err.message, 'red');
            }
          });
      }
    },

    openSessionDetails() {
      if (!this.sessionModal) this.sessionModal = document.getElementById('sessionDetailsModal');
      if (!this.sessionModal) return;

      const active = (this.allSessions && this.allSessions.find((s) => s.sessionId === this.currentSessionId)) ||
                     (this.recentSessions && this.recentSessions.find((s) => s.sessionId === this.currentSessionId)) || {
        sessionId: this.currentSessionId || 'None',
        status: this.isWorking ? 'working' : this.isWaiting ? 'waiting' : 'idle',
        workspaceName: 'soko',
      };

      const idEl = document.getElementById('modalSessionId');
      const statusEl = document.getElementById('modalSessionStatus');
      const wsEl = document.getElementById('modalSessionWorkspace');
      const tokensEl = document.getElementById('modalSessionTokens');
      const turnsEl = document.getElementById('modalSessionTurns');
      const timeEl = document.getElementById('modalSessionTime');

      if (idEl) idEl.textContent = active.sessionId || this.currentSessionId || 'No active session';
      if (statusEl) {
        const st = active.status || (this.isWorking ? 'working' : this.isWaiting ? 'waiting' : 'idle');
        statusEl.textContent = st.charAt(0).toUpperCase() + st.slice(1);
      }
      if (wsEl) wsEl.textContent = active.workspace || active.workspaceName || 'soko';
      if (tokensEl) tokensEl.textContent = active.tokensUsed ? `${active.tokensUsed.toLocaleString()} tokens` : 'Calculated per turn';
      if (turnsEl) turnsEl.textContent = `${this.turns.length} turn${this.turns.length !== 1 ? 's' : ''}`;
      if (timeEl) {
        timeEl.textContent = active.mtimeMs ? new Date(active.mtimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live';
      }

      this.sessionModal.style.display = 'flex';
    },

    closeSessionDetails() {
      if (!this.sessionModal) this.sessionModal = document.getElementById('sessionDetailsModal');
      if (this.sessionModal) {
        this.sessionModal.style.display = 'none';
      }
    },

    copySessionId() {
      const activeId = this.currentSessionId;
      if (!activeId) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(activeId).then(() => {
          if (typeof window.showToast === 'function') {
            window.showToast('Copied Conversation ID ✓', 'info');
          }
        }).catch(() => {
          this.fallbackCopy(activeId);
        });
      } else {
        this.fallbackCopy(activeId);
      }
    },

    fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        if (typeof window.showToast === 'function') {
          window.showToast('Copied Conversation ID ✓', 'info');
        }
      } catch {}
      document.body.removeChild(ta);
    },

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
  };

  window.AgentTerminal = AgentTerminal;

  // Auto-init on DOMContentLoaded or immediate if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AgentTerminal.init());
  } else {
    AgentTerminal.init();
  }
})(window);
