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
  final _streamingController = StreamController<bool>.broadcast();
  final _agentDoneController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<List<AgentSessionSummary>> get sessionsStream => _sessionsController.stream;
  Stream<List<AgentTranscriptTurn>> get turnsStream => _turnsController.stream;
  Stream<AgentSessionSummary?> get activeSessionStream => _activeSessionController.stream;
  Stream<bool> get streamingStream => _streamingController.stream;
  Stream<Map<String, dynamic>> get agentDoneStream => _agentDoneController.stream;

  String? _currentSessionId;
  List<AgentTranscriptTurn> _turns = [];
  bool _isWorking = false;
  bool _isStreaming = false;
  String? _previousStatus;

  String? get currentSessionId => _currentSessionId;
  bool get isWorking => _isWorking;
  bool get isStreaming => _isStreaming;

  StreamSubscription<SokoEnvelope>? _bleSubscription;

  AgentRemoteService({required this.bleService}) {
    _bleSubscription = bleService.inboundStream.listen((envelope) {
      handleInboundPacket(envelope.packetType, envelope.payload);
    });
  }

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
      case PacketType.notificationPost:
        if (payload['isAgentDone'] == true || payload['isTaskDone'] == true) {
          _agentDoneController.add(payload);
        }
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

    // When agent completes, emit notification to mobile companion
    final wasRunning = _previousStatus == 'working' || _previousStatus == 'thinking' || _previousStatus == 'waiting';
    if (wasRunning && status == 'completed') {
      _agentDoneController.add(payload);
    }
    _previousStatus = status;

    final sessionId = payload['sessionId'] as String?;
    if (sessionId != null && sessionId.isNotEmpty) {
      _currentSessionId ??= sessionId;
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
    // Stream terminal texts ONLY when requested
    if (!_isStreaming) return;

    final chunkSessionId = payload['sessionId'] as String?;
    if (chunkSessionId != null && _currentSessionId != null && chunkSessionId != _currentSessionId) return;
    if (_currentSessionId == null && chunkSessionId != null && chunkSessionId.isNotEmpty) {
      _currentSessionId = chunkSessionId;
    }

    final rawEvents = payload['events'] as List<dynamic>?;
    if (rawEvents == null || rawEvents.isEmpty) {
      // Refresh history if turns list is empty
      if (_turns.isEmpty && _currentSessionId != null) {
        subscribeToSession(_currentSessionId!);
      }
      return;
    }

    bool updated = false;
    final List<AgentTranscriptTurn> turnList = List.from(_turns);

    for (final rawEv in rawEvents) {
      if (rawEv is! Map<String, dynamic>) continue;
      final type = rawEv['type'] as String? ?? '';

      if (type == 'USER_INPUT') {
        final content = (rawEv['content'] as String?)?.trim() ?? '';
        if (content.isNotEmpty) {
          final stepIdx = rawEv['step_index'] as int? ?? turnList.length + 1;
          final turn = AgentTranscriptTurn(
            id: 'turn-$stepIdx',
            stepIndex: stepIdx,
            timestamp: DateTime.now().millisecondsSinceEpoch,
            userInput: content,
            thinking: const [],
            toolCalls: const [],
            responses: const [],
            status: 'working',
          );
          turnList.add(turn);
          updated = true;
        }
      } else {
        if (turnList.isEmpty) {
          turnList.add(AgentTranscriptTurn(
            id: 'turn-${DateTime.now().millisecondsSinceEpoch}',
            stepIndex: 1,
            timestamp: DateTime.now().millisecondsSinceEpoch,
            userInput: 'Task in progress',
            thinking: const [],
            toolCalls: const [],
            responses: const [],
            status: 'working',
          ));
          updated = true;
        }

        final lastTurn = turnList.last;
        final thinking = List<String>.from(lastTurn.thinking);
        final toolCalls = List<AgentToolCallItem>.from(lastTurn.toolCalls);
        final responses = List<String>.from(lastTurn.responses);
        String turnStatus = lastTurn.status;

        // Process thinking
        final rawThinking = rawEv['thinking']?.toString().trim();
        if (rawThinking != null && rawThinking.isNotEmpty && !thinking.contains(rawThinking)) {
          thinking.add(rawThinking);
          updated = true;
        }

        // Process tool_calls
        final rawTools = rawEv['tool_calls'] as List<dynamic>?;
        if (rawTools != null && rawTools.isNotEmpty) {
          for (final rawTool in rawTools) {
            if (rawTool is Map<String, dynamic>) {
              final toolItem = AgentToolCallItem.fromJson(rawTool);
              if (!toolCalls.any((t) => t.summary == toolItem.summary)) {
                toolCalls.add(toolItem);
                updated = true;
              }
            }
          }
        }

        // Process responses
        final rawContent = rawEv['content']?.toString().trim();
        if (rawContent != null &&
            rawContent.isNotEmpty &&
            (type == 'PLANNER_RESPONSE' || type == 'MODEL' || type == 'ASSISTANT') &&
            type != 'GENERIC' &&
            !rawContent.startsWith('<') &&
            !rawContent.contains('vertexaisearch.cloud.google.com') &&
            !rawContent.contains('grounding-api-redirect') &&
            !rawContent.startsWith('Created At:') &&
            !responses.contains(rawContent)) {
          responses.add(rawContent);
          updated = true;
        }

        if (rawEv['status'] == 'DONE') {
          turnStatus = 'completed';
          updated = true;
        }

        turnList[turnList.length - 1] = lastTurn.copyWith(
          thinking: thinking,
          toolCalls: toolCalls,
          responses: responses,
          status: turnStatus,
        );
      }
    }

    if (updated) {
      _turns = turnList;
      _turnsController.add(List.unmodifiable(_turns));
    }
  }

  /// Request live terminal streaming for target session ID
  Future<void> requestTerminalStream(String sessionId) async {
    _currentSessionId = sessionId;
    _isStreaming = true;
    _streamingController.add(true);
    debugPrint('[AgentRemoteService] Requesting terminal stream for: $sessionId');
    await bleService.sendPacket(
      PacketType.agentTranscriptHistory,
      {'sessionId': sessionId, 'maxTurns': 30, 'stream': true},
    );
  }

  /// Pause/stop live terminal streaming
  Future<void> stopTerminalStream() async {
    _isStreaming = false;
    _streamingController.add(false);
    debugPrint('[AgentRemoteService] Stopping terminal stream for: $_currentSessionId');
    if (_currentSessionId != null) {
      await bleService.sendPacket(
        PacketType.agentActivityStatus,
        {'action': 'stop_stream', 'sessionId': _currentSessionId},
      );
    }
  }

  /// Subscribe to target session ID
  Future<void> subscribeToSession(String sessionId) async {
    _currentSessionId = sessionId;
    debugPrint('[AgentRemoteService] Subscribing to session: $sessionId');
    await bleService.sendPacket(
      PacketType.agentTranscriptHistory,
      {'sessionId': sessionId, 'maxTurns': 30, 'stream': _isStreaming},
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
    _bleSubscription?.cancel();
    _sessionsController.close();
    _turnsController.close();
    _activeSessionController.close();
    _streamingController.close();
    _agentDoneController.close();
  }
}
