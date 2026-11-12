import 'package:flutter/material.dart';
import '../../../core/theme/glass_theme.dart';
import '../../widgets/glass_card.dart';
import '../models/agent_models.dart';
import '../services/agent_remote_service.dart';

/// Full interactive mobile terminal for Google Antigravity & AI CLI agents.
class AgentTerminalView extends StatefulWidget {
  final VoidCallback onBack;
  final AgentRemoteService? service;

  const AgentTerminalView({
    super.key,
    required this.onBack,
    this.service,
  });

  @override
  State<AgentTerminalView> createState() => _AgentTerminalViewState();
}

class _AgentTerminalViewState extends State<AgentTerminalView> {
  final TextEditingController _promptController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<AgentTranscriptTurn> _turns = [];
  AgentSessionSummary? _activeSession;
  List<AgentSessionSummary> _availableSessions = [];
  bool _isWorking = false;
  bool _isStreaming = false;

  @override
  void initState() {
    super.initState();
    _initListeners();
    _seedMockStateIfIsolated();
    final s = widget.service;
    if (s != null) {
      s.fetchSessions();
      final sId = s.currentSessionId;
      if (sId != null && sId.isNotEmpty && !s.isStreaming) {
        s.requestTerminalStream(sId);
      }
    }
  }

  void _initListeners() {
    final s = widget.service;
    if (s == null) return;

    s.turnsStream.listen((turns) {
      if (mounted) {
        setState(() => _turns = turns);
        _scrollToBottom();
      }
    });

    s.activeSessionStream.listen((session) {
      if (mounted) {
        setState(() {
          _activeSession = session;
          _isWorking = session?.status == 'working' || session?.status == 'thinking';
        });
        if (session != null && !s.isStreaming && _turns.isEmpty) {
          s.requestTerminalStream(session.sessionId);
        }
      }
    });

    s.sessionsStream.listen((sessions) {
      if (mounted) {
        setState(() => _availableSessions = sessions);
      }
    });

    s.streamingStream.listen((streaming) {
      if (mounted) {
        setState(() => _isStreaming = streaming);
      }
    });

    s.agentDoneStream.listen((event) {
      if (mounted) {
        final title = event['title'] as String? ?? 'Agent Task Done ✓';
        final message = (event['message'] ?? event['taskSummary']) as String? ?? 'Agent completed all steps.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Color(0xFF22C55E), size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text('$title: $message')),
              ],
            ),
            backgroundColor: const Color(0xFF1E293B),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    });
  }

  void _seedMockStateIfIsolated() {
    if (widget.service != null) return;

    // Standalone preview data for UI testing
    _activeSession = AgentSessionSummary(
      sessionId: 'preview-session-id',
      name: 'Google Antigravity Agent',
      status: 'working',
      workspaceName: 'soko',
      tokensUsed: 14200,
      taskSummary: 'Tailing transcript & streaming turns to phone',
    );

    _turns = [
      AgentTranscriptTurn(
        id: 't-1',
        timestamp: DateTime.now().millisecondsSinceEpoch - 60000,
        userInput: 'Check current repository health and fix mobile terminal view',
        thinking: [
          'Scanning packages/agent-remote...',
          'Found active session in brain directory. Initializing live tailer.',
        ],
        toolCalls: [
          AgentToolCallItem(
            name: 'run_command',
            summary: '\$ npm test',
            args: {'CommandLine': 'npm test'},
          ),
          AgentToolCallItem(
            name: 'edit_file',
            summary: 'Edit terminal_remote_screen.dart',
            args: {'Path': 'terminal_remote_screen.dart'},
          ),
        ],
        responses: [
          'All test suites verified. Mobile remote terminal now mirrors PC sessions in real time.',
        ],
      ),
    ];
    _isWorking = true;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _submitPrompt([String? customText]) {
    final text = (customText ?? _promptController.text).trim();
    if (text.isEmpty) return;

    if (widget.service != null) {
      widget.service!.sendPrompt(text);
    } else {
      // Local optimistic update for standalone preview
      setState(() {
        _turns.add(AgentTranscriptTurn(
          id: 'local-${DateTime.now().millisecondsSinceEpoch}',
          timestamp: DateTime.now().millisecondsSinceEpoch,
          userInput: text,
          thinking: ['Dispatching prompt to host CLI agent...'],
        ));
      });
      _scrollToBottom();
    }

    _promptController.clear();
  }

  @override
  void dispose() {
    if (widget.service?.isStreaming == true) {
      widget.service?.stopTerminalStream();
    }
    _promptController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GlassTheme.bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: widget.onBack,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _activeSession?.name ?? 'Agent Terminal',
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isWorking ? GlassTheme.cyanAccent : const Color(0xFF22C55E),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isWorking ? 'Working on task...' : 'Connected • Ready',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _isStreaming ? Icons.cell_tower_rounded : Icons.play_arrow_rounded,
              color: _isStreaming ? const Color(0xFF22C55E) : Colors.white70,
              size: 20,
            ),
            tooltip: _isStreaming ? 'Terminal Streaming Active (Tap to pause)' : 'Request Terminal Stream',
            onPressed: () {
              if (_isStreaming) {
                widget.service?.stopTerminalStream();
              } else {
                final sId = _activeSession?.sessionId ?? widget.service?.currentSessionId;
                if (sId != null) {
                  widget.service?.requestTerminalStream(sId);
                }
              }
            },
          ),
          if (_availableSessions.length > 1)
            PopupMenuButton<String>(
              icon: const Icon(Icons.swap_horiz_rounded, color: Colors.white70),
              tooltip: 'Switch Session',
              onSelected: (id) => widget.service?.subscribeToSession(id),
              itemBuilder: (ctx) => _availableSessions
                  .map((s) => PopupMenuItem(
                        value: s.sessionId,
                        child: Text(s.workspaceName ?? s.sessionId.substring(0, 8)),
                      ))
                  .toList(),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Quick Session Stats Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
              child: GlassCard(
                opacity: 0.08,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.folder_outlined, color: GlassTheme.cyanAccent, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          _activeSession?.workspaceName ?? 'soko monorepo',
                          style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    GestureDetector(
                      onTap: () {
                        if (_isStreaming) {
                          widget.service?.stopTerminalStream();
                        } else {
                          final sId = _activeSession?.sessionId ?? widget.service?.currentSessionId;
                          if (sId != null) {
                            widget.service?.requestTerminalStream(sId);
                          }
                        }
                      },
                      child: Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isStreaming ? const Color(0xFF22C55E) : Colors.white24,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _isStreaming ? 'Streaming ON' : 'Stream OFF',
                            style: TextStyle(
                              color: _isStreaming ? const Color(0xFF22C55E) : Colors.white.withOpacity(0.4),
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: _isStreaming ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Live Feed List View
            Expanded(
              child: _turns.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.terminal_rounded, size: 48, color: Colors.white.withOpacity(0.2)),
                          const SizedBox(height: 12),
                          const Text(
                            'Connected to PC Host',
                            style: TextStyle(color: Colors.white70, fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _isStreaming
                                ? 'Streaming live agent activity & execution output...'
                                : 'Tap "Request Terminal Stream" to begin streaming text.',
                            style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                          if (!_isStreaming) ...[
                            const SizedBox(height: 12),
                            ElevatedButton.icon(
                              onPressed: () {
                                final sId = _activeSession?.sessionId ?? widget.service?.currentSessionId;
                                if (sId != null) {
                                  widget.service?.requestTerminalStream(sId);
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: GlassTheme.cyanAccent.withOpacity(0.2),
                                foregroundColor: GlassTheme.cyanAccent,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              icon: const Icon(Icons.play_arrow_rounded, size: 16),
                              label: const Text('Request Terminal Stream'),
                            ),
                          ],
                        ],
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                      itemCount: _turns.length,
                      itemBuilder: (context, index) {
                        final turn = _turns[index];
                        return _buildTurnWidget(turn);
                      },
                    ),
            ),

            // Quick Prompt Suggestion Chips
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _buildQuickChip('✨ Approve', 'Approve and proceed with changes'),
                  _buildQuickChip('🧪 Run Tests', 'Run npm test and verify suites'),
                  _buildQuickChip('🔍 Git Status', 'git status --short'),
                  _buildQuickChip('📝 Explain', 'Explain the code changes'),
                  _buildQuickChip('🛑 Stop', 'Please stop execution'),
                ],
              ),
            ),

            const SizedBox(height: 6),

            // Bottom Input Deck
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: GlassCard(
                opacity: 0.15,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _promptController,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: _isWorking
                              ? 'Agent working... Message will be queued'
                              : 'Send instruction to PC agent...',
                          hintStyle: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 12),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                        ),
                        onSubmitted: (val) => _submitPrompt(),
                      ),
                    ),
                    const SizedBox(width: 6),
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: GlassTheme.cyanAccent.withOpacity(0.25),
                          foregroundColor: GlassTheme.cyanAccent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: EdgeInsets.zero,
                          elevation: 0,
                        ),
                        onPressed: () => _submitPrompt(),
                        child: const Icon(Icons.send_rounded, size: 18),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickChip(String label, String prompt) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4.0),
      child: ActionChip(
        backgroundColor: Colors.white.withOpacity(0.06),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        label: Text(
          label,
          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
        ),
        onPressed: () => _submitPrompt(prompt),
      ),
    );
  }

  Widget _buildTurnWidget(AgentTranscriptTurn turn) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // User Prompt Bubble
          if (turn.userInput != null && turn.userInput!.isNotEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 300),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: GlassTheme.cyanAccent.withOpacity(0.18),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(14),
                    topRight: Radius.circular(14),
                    bottomLeft: Radius.circular(14),
                    bottomRight: Radius.circular(4),
                  ),
                  border: Border.all(color: GlassTheme.cyanAccent.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.person_rounded, size: 12, color: GlassTheme.cyanAccent),
                        const SizedBox(width: 4),
                        const Text(
                          'You',
                          style: TextStyle(color: GlassTheme.cyanAccent, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      turn.userInput!,
                      style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4),
                    ),
                  ],
                ),
              ),
            ),

          // Thinking Box
          if (turn.thinking.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.psychology_rounded, size: 14, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 6),
                      Text(
                        'Thinking Process (${turn.thinking.length} step)',
                        style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    turn.thinking.join('\n'),
                    style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
          ],

          // Tool Call Action Cards
          for (final tool in turn.toolCalls) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.build_circle_outlined, size: 14, color: Color(0xFFC084FC)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      tool.summary,
                      style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'monospace'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Agent Response Message
          for (final resp in turn.responses) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 320),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.06),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(14),
                    topRight: Radius.circular(14),
                    bottomLeft: Radius.circular(4),
                    bottomRight: Radius.circular(14),
                  ),
                  border: Border.all(color: Colors.white12),
                ),
                child: Text(
                  resp,
                  style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.45),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
