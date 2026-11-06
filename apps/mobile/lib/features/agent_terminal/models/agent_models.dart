/// Models for Agent Remote Terminal and Live Transcript Streaming.

class AgentSessionSummary {
  final String sessionId;
  final String? name;
  final String status;
  final String? workspaceName;
  final String? workspace;
  final int? tokensUsed;
  final String? taskSummary;

  AgentSessionSummary({
    required this.sessionId,
    this.name,
    required this.status,
    this.workspaceName,
    this.workspace,
    this.tokensUsed,
    this.taskSummary,
  });

  factory AgentSessionSummary.fromJson(Map<String, dynamic> json) {
    return AgentSessionSummary(
      sessionId: json['sessionId'] as String? ?? '',
      name: json['name'] as String?,
      status: json['status'] as String? ?? 'idle',
      workspaceName: json['workspaceName'] as String?,
      workspace: json['workspace'] as String?,
      tokensUsed: json['tokensUsed'] as int?,
      taskSummary: json['taskSummary'] as String? ?? json['detail'] as String?,
    );
  }
}

class AgentToolCallItem {
  final String name;
  final String summary;
  final Map<String, dynamic> args;

  AgentToolCallItem({
    required this.name,
    required this.summary,
    required this.args,
  });

  factory AgentToolCallItem.fromJson(Map<String, dynamic> json) {
    return AgentToolCallItem(
      name: json['name'] as String? ?? 'tool',
      summary: json['summary'] as String? ?? '',
      args: (json['args'] as Map<String, dynamic>?) ?? {},
    );
  }
}

class AgentTranscriptTurn {
  final String id;
  final int stepIndex;
  final int timestamp;
  final String? userInput;
  final List<String> thinking;
  final List<AgentToolCallItem> toolCalls;
  final List<String> responses;
  final String status;

  AgentTranscriptTurn({
    required this.id,
    this.stepIndex = 0,
    required this.timestamp,
    this.userInput,
    this.thinking = const [],
    this.toolCalls = const [],
    this.responses = const [],
    this.status = 'completed',
  });

  factory AgentTranscriptTurn.fromJson(Map<String, dynamic> json) {
    final toolList = (json['toolCalls'] as List<dynamic>?)
            ?.map((e) => AgentToolCallItem.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final thinkingList = (json['thinking'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];

    final respList = (json['responses'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];

    return AgentTranscriptTurn(
      id: json['id'] as String? ?? 'turn-${DateTime.now().millisecondsSinceEpoch}',
      stepIndex: json['stepIndex'] as int? ?? 0,
      timestamp: json['timestamp'] as int? ?? DateTime.now().millisecondsSinceEpoch,
      userInput: json['userInput'] as String?,
      thinking: thinkingList,
      toolCalls: toolList,
      responses: respList,
      status: json['status'] as String? ?? 'completed',
    );
  }
}
