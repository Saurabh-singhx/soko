import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/protocol/packet_models.dart';
import '../../../services/bluetooth/ble_service.dart';
import '../models/agent_models.dart';

/// Service coordinating real-time Agent Terminal interaction over WebSocket/BLE.
class AgentRemoteService {
  final MobileBleService bleService;

  final _sessionsController = StreamController<List<AgentSessionSummary>>.broadcast();
  final _turnsController = StreamController<List<AgentTranscriptTurn>>.broadcast();
  final _activeSessionController = StreamController<AgentSessionSummary?>.broadcast();

  Stream<List<AgentSessionSummary>> get sessionsStream => _sessionsController.stream;
  Stream<List<AgentTranscriptTurn>> get turnsStream => _turnsController.stream;
  Stream<AgentSessionSummary?> get activeSessionStream => _activeSessionController.stream;

  String? _currentSessionId;
  List<AgentTranscriptTurn> _turns = [];
  bool _isWorking = false;

  String? get currentSessionId => _currentSessionId;
  bool get isWorking => _isWorking;

  AgentRemoteService({required this.bleService});

  /// Inbound packet dispatcher
  void handleInboundPacket(PacketType type, Map<String, dynamic> payload) {
    switch (type) {
      case PacketType.agentActivityStatus:
        _handleActivityStatus(payload);
        break;
      case PacketType.agentTranscriptHistory:
        _handleTranscriptHistory(payload);
        break;
      case PacketType.agentTranscriptChunk:
        _handleTranscriptChunk(payload);
        break;
      default:
        break;
    }
  }

  void _handleActivityStatus(Map<String, dynamic> payload) {
    final activeList = (payload['activeSessions'] as List<dynamic>?)
            ?.map((e) => AgentSessionSummary.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    _sessionsController.add(activeList);

    final status = payload['status'] as String? ?? 'idle';
    _isWorking = status == 'working' || status == 'thinking';

    final sessionId = payload['sessionId'] as String?;
    if (sessionId != null && sessionId.isNotEmpty) {
      if (_currentSessionId == null) {
        subscribeToSession(sessionId);
      }
      final current = activeList.firstWhere(
        (s) => s.sessionId == sessionId,
        orElse: () => AgentSessionSummary(
          sessionId: sessionId,
          name: payload['name'] as String?,
          status: status,
          workspaceName: payload['workspaceName'] as String?,
          tokensUsed: payload['tokensUsed'] as int?,
          taskSummary: payload['taskSummary'] as String?,
        ),
      );
      _activeSessionController.add(current);
    }
  }

  void _handleTranscriptHistory(Map<String, dynamic> payload) {
    final rawTurns = (payload['turns'] as List<dynamic>?)
            ?.map((e) => AgentTranscriptTurn.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    _turns = rawTurns;
    _turnsController.add(List.unmodifiable(_turns));
  }

  void _handleTranscriptChunk(Map<String, dynamic> payload) {
    final chunkSessionId = payload['sessionId'] as String?;
    if (chunkSessionId != _currentSessionId) return;

    // Refresh history if new events arrived
    if (_currentSessionId != null) {
      subscribeToSession(_currentSessionId!);
    }
  }

  /// Subscribe to target session ID
  Future<void> subscribeToSession(String sessionId) async {
    _currentSessionId = sessionId;
    debugPrint('[AgentRemoteService] Subscribing to session: $sessionId');
    await bleService.sendPacket(
      PacketType.agentTranscriptHistory,
      {'sessionId': sessionId, 'maxTurns': 30},
    );
  }

  /// Query all active sessions
  Future<void> fetchSessions() async {
    await bleService.sendPacket(PacketType.fetchAgentSessions, {});
  }

  /// Send prompt to PC agent
  Future<void> sendPrompt(String prompt) async {
    if (_currentSessionId == null || prompt.trim().isEmpty) return;

    // Optimistic turn addition for instantaneous UX
    final localTurn = AgentTranscriptTurn(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      userInput: prompt.trim(),
      thinking: ['Dispatching prompt to host CLI agent...'],
      toolCalls: [],
      responses: [],
      status: 'working',
    );

    _turns = [..._turns, localTurn];
    _turnsController.add(List.unmodifiable(_turns));

    await bleService.sendPacket(PacketType.agentSendPrompt, {
      'sessionId': _currentSessionId,
      'prompt': prompt.trim(),
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  void dispose() {
    _sessionsController.close();
    _turnsController.close();
    _activeSessionController.close();
  }
}
