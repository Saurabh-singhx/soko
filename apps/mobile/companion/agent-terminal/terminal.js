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
    activeSessions: [],
    turns: [],
    isWorking: false,
    isWaiting: false,
    cursor: 0,
    pollTimer: null,
    isPreviewMode: false,

    init() {
      console.log('[Agent Terminal] Initializing remote agent subsystem...');
      this.bindDOMElements();
      this.attachEventListeners();

      // If running with preview=1 or local file in mobile-preview, load rich preview state
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('preview') === '1' || urlParams.get('mock') === '1' || window.location.protocol === 'file:') {
        this.isPreviewMode = true;
        this.loadPreviewState();
        return;
      }

      // If WebSocket already connected, fetch initial sessions
      if (typeof window.sendPacket === 'function') {
        this.fetchSessions();
      }

      // Periodic safety sync (every 2.5s) when CLI tab is visible
      if (!this.pollTimer) {
        this.pollTimer = setInterval(() => {
          if (document.getElementById('tab-cli')?.classList.contains('active')) {
            this.syncCurrentSession();
          }
        }, 2500);
      }
    },

    loadPreviewState() {
      this.currentSessionId = 'preview-session-antigravity';
      this.activeSessions = [
        {
          sessionId: 'preview-session-antigravity',
          name: 'Google Antigravity Agent',
          status: 'working',
          workspaceName: 'soko',
        },
        {
          sessionId: 'preview-session-backend',
          name: 'Backend Core Daemon',
          status: 'idle',
          workspaceName: 'soko/packages',
        },
      ];

      if (this.sessionSelect) {
        this.sessionSelect.innerHTML = '';
        this.activeSessions.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = s.sessionId;
          opt.textContent = `[${s.workspaceName}] ${s.sessionId.slice(0, 8)} (${s.status})`;
          this.sessionSelect.appendChild(opt);
        });
        this.sessionSelect.value = this.currentSessionId;
      }

      if (this.statusDot) this.statusDot.className = 'agent-status-dot working';
      if (this.statusText) this.statusText.textContent = 'Working';
      if (this.headerAppTitle) this.headerAppTitle.textContent = 'soko';
      if (this.headerSubtitle) this.headerSubtitle.textContent = '14,850 tokens • Mirroring PC terminal';

      this.turns = [
        {
          id: 'turn-1',
          stepIndex: 1,
          timestamp: Date.now() - 45000,
          userInput: 'Check current test suite and enable live terminal mirroring on mobile companion',
          thinking: [
            'Inspecting ~/.gemini/antigravity-cli/brain for active sessions...',
            'Byte offset cursor calibrated at 4,096 bytes.',
            'Setting up WebSocket event transmitter on port 8766.',
          ],
          toolCalls: [
            {
              name: 'run_command',
              summary: 'npm test',
            },
            {
              name: 'edit_file',
              summary: 'apps/mobile/companion/agent-terminal/terminal.js',
            },
          ],
          responses: [
            'All 95 integration tests passed. Live transcript streaming and turn queueing are active on port 8766.',
          ],
        },
        {
          id: 'turn-2',
          stepIndex: 2,
          timestamp: Date.now() - 5000,
          userInput: 'Verify responsive viewports and safe area padding on mobile devices',
          thinking: [
            'Checking mobile touch target sizes (minimum 40x40px)...',
            'Verifying bottom clearance for floating navigation dock.',
          ],
          toolCalls: [
            {
              name: 'run_command',
              summary: 'mobile-preview --audit',
            },
          ],
          responses: [
            'Viewport audit passed with 0 errors. Touch targets and safe area insets are verified across all presets.',
          ],
        },
      ];

      this.renderFeed();
    },

    bindDOMElements() {
      this.feedScroll = document.getElementById('agentFeedScroll');
      this.sessionSelect = document.getElementById('agentSessionSelect');
      this.statusDot = document.getElementById('agentStatusDot');
      this.statusText = document.getElementById('agentStatusText');
      this.headerAppTitle = document.getElementById('headerAppTitle');
      this.headerSubtitle = document.getElementById('headerSubtitle');
      this.promptInput = document.getElementById('agentPromptInput');
      this.sendBtn = document.getElementById('agentSendBtn');
      this.exitBtn = document.getElementById('agentExitBtn');
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
          const selectedId = e.target.value;
          if (selectedId && selectedId !== this.currentSessionId) {
            this.switchSession(selectedId);
          }
        });
      }
    },

    /**
     * Called whenever user switches to the Terminal tab.
     */
    onTabActivated() {
      this.bindDOMElements();
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
     * Updates session switcher options and auto-selects active session.
     */
    updateSessionList(sessions) {
      if (!Array.isArray(sessions)) return;
      this.activeSessions = sessions;

      if (!this.sessionSelect) {
        this.sessionSelect = document.getElementById('agentSessionSelect');
      }
      if (!this.sessionSelect) return;
      this.sessionSelect.innerHTML = '';

      if (sessions.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No active sessions';
        this.sessionSelect.appendChild(opt);
        if (this.turns.length === 0) {
          this.renderEmptyState('No active agent session detected. Start an agent turn on your PC to mirror live here.');
        }
        return;
      }

      sessions.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.sessionId;
        const wsName = s.workspaceName || 'agent';
        opt.textContent = `[${wsName}] ${s.sessionId.slice(0, 8)} (${s.status || 'active'})`;
        this.sessionSelect.appendChild(opt);
      });

      // Auto-select first active or working session
      if (!this.currentSessionId || !sessions.some((s) => s.sessionId === this.currentSessionId)) {
        const preferred = sessions.find((s) => s.status === 'working' || s.isLocked) || sessions[0];
        if (preferred) {
          this.switchSession(preferred.sessionId);
        }
      } else {
        this.sessionSelect.value = this.currentSessionId;
      }
    },

    /**
     * Switches feed to view target session ID.
     */
    switchSession(sessionId) {
      if (!sessionId) return;
      this.currentSessionId = sessionId;
      if (this.sessionSelect) {
        this.sessionSelect.value = sessionId;
      }

      const activeSession = this.activeSessions.find((s) => s.sessionId === sessionId);
      if (activeSession) {
        if (this.headerAppTitle) this.headerAppTitle.textContent = activeSession.workspaceName || 'Soko Agent';
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

      if (!this.statusDot) this.statusDot = document.getElementById('agentStatusDot');
      if (!this.statusText) this.statusText = document.getElementById('agentStatusText');

      if (this.statusDot) {
        this.statusDot.className = `agent-status-dot ${isWorking ? 'working' : isWaiting ? 'waiting' : 'idle'}`;
      }

      if (this.statusText) {
        this.statusText.textContent = isWorking ? 'Working' : isWaiting ? 'Waiting' : 'Idle';
      }

      const isTerminalActive = document.getElementById('tab-cli')?.classList.contains('active');
      if (isTerminalActive) {
        if (this.headerAppTitle) {
          this.headerAppTitle.textContent = payload.workspaceName || 'Soko Agent';
        }
        if (this.headerSubtitle) {
          const tokens = payload.tokensUsed ? `${payload.tokensUsed.toLocaleString()} tokens` : '';
          const task = payload.taskSummary || payload.detail || (isWorking ? 'Executing...' : 'Ready');
          this.headerSubtitle.textContent = [tokens, task].filter(Boolean).join(' • ');
        }
      }
    },

    /**
     * Handles initial full transcript history payload.
     */
    handleTranscriptHistory(data) {
      if (!data || !Array.isArray(data.turns)) return;
      this.turns = data.turns;
      this.cursor = data.cursor || 0;
      this.isWorking = Boolean(data.isWorking);
      this.isWaiting = Boolean(data.isWaiting);

      this.renderFeed();
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

            if (ev.content && (type === 'PLANNER_RESPONSE' || type === 'MODEL' || ev.source === 'MODEL')) {
              const cleanR = String(ev.content).trim();
              if (cleanR && !cleanR.startsWith('<') && !currentTurn.responses.includes(cleanR)) {
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

        // 2. Compact Thought Accordion (Minimal, soft amber disclosure)
        if (turn.thinking && turn.thinking.length > 0) {
          const thinkingText = turn.thinking.join('\n');
          const thinkEl = document.createElement('div');
          thinkEl.className = 'feed-thought-row';
          thinkEl.title = 'Tap to toggle thought process';
          thinkEl.innerHTML = `
            <span class="feed-thought-label">💭 Thought Process (${turn.thinking.length} step${turn.thinking.length > 1 ? 's' : ''})</span>
            <span class="feed-thought-toggle">[Show ▾]</span>
          `;
          const bodyEl = document.createElement('div');
          bodyEl.className = 'feed-thought-body';
          bodyEl.style.display = 'none';
          bodyEl.textContent = thinkingText;

          thinkEl.onclick = () => {
            const isHidden = bodyEl.style.display === 'none';
            bodyEl.style.display = isHidden ? 'block' : 'none';
            thinkEl.querySelector('.feed-thought-toggle').textContent = isHidden ? '[Hide ▴]' : '[Show ▾]';
          };

          itemEl.appendChild(thinkEl);
          itemEl.appendChild(bodyEl);
        }

        // 3. Compact Activity & Tool Execution Pill (Unified, uncluttered)
        if (turn.toolCalls && turn.toolCalls.length > 0) {
          const toolCount = turn.toolCalls.length;
          const firstSummary = turn.toolCalls[0].summary || turn.toolCalls[0].name || 'tool';
          const summaryLabel = toolCount === 1
            ? `⚡ ${firstSummary.slice(0, 42)}`
            : `⚡ Executed ${toolCount} actions (${turn.toolCalls.map((t) => t.name).slice(0, 3).join(', ')})`;

          const activityEl = document.createElement('div');
          activityEl.className = 'feed-activity-pill';
          activityEl.title = 'Tap to view execution details';
          activityEl.innerHTML = `
            <span class="feed-activity-label">${this.escapeHtml(summaryLabel)}</span>
            <span class="feed-activity-toggle">[Details ▾]</span>
          `;

          const detailsEl = document.createElement('div');
          detailsEl.className = 'feed-activity-details';
          detailsEl.style.display = 'none';

          turn.toolCalls.forEach((tc) => {
            const line = document.createElement('div');
            line.className = 'feed-tool-line';
            line.textContent = `$ ${tc.name}: ${tc.summary || ''}`;
            detailsEl.appendChild(line);
          });

          activityEl.onclick = () => {
            const isHidden = detailsEl.style.display === 'none';
            detailsEl.style.display = isHidden ? 'flex' : 'none';
            activityEl.querySelector('.feed-activity-toggle').textContent = isHidden ? '[Hide ▴]' : '[Details ▾]';
          };

          itemEl.appendChild(activityEl);
          itemEl.appendChild(detailsEl);
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
