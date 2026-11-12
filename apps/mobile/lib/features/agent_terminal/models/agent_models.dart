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
    final name = json['name'] as String? ?? 'tool';
    final args = (json['args'] as Map<String, dynamic>?) ?? {};
    String summary = json['summary'] as String? ?? '';

    if (summary.isEmpty) {
      if (name == 'run_command' || name == 'execute_command') {
        final cmd = (args['CommandLine'] ?? args['command'] ?? '').toString().trim();
        summary = cmd.isNotEmpty ? '\$ $cmd' : 'Run command';
      } else if (name == 'edit_file' || name == 'edit_file_replace') {
        final p = (args['Path'] ?? args['path'] ?? '').toString().trim();
        final base = p.split(RegExp(r'[\\/]')).last;
        summary = base.isNotEmpty ? 'Edit $base' : 'Editing file';
      } else if (name == 'write_file' || name == 'write_to_file') {
        final p = (args['Path'] ?? args['path'] ?? '').toString().trim();
        final base = p.split(RegExp(r'[\\/]')).last;
        summary = base.isNotEmpty ? 'Create $base' : 'Creating file';
      } else if (name == 'read_file') {
        final p = (args['Path'] ?? args['path'] ?? '').toString().trim();
        final base = p.split(RegExp(r'[\\/]')).last;
        summary = base.isNotEmpty ? 'Read $base' : 'Reading file';
      } else if (name == 'search_web') {
        final q = (args['query'] ?? '').toString().trim();
        summary = q.isNotEmpty ? 'Search: "$q"' : 'Searching web';
      } else if (name == 'ask_question') {
        summary = 'Clarifying requirements with user';
      } else if (name == 'send_message') {
        summary = 'Sending final report to caller';
      } else {
        summary = 'Execute $name';
      }
    }

    return AgentToolCallItem(
      name: name,
      summary: summary,
      args: args,
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

  AgentTranscriptTurn copyWith({
    String? id,
    int? stepIndex,
    int? timestamp,
    String? userInput,
    List<String>? thinking,
    List<AgentToolCallItem>? toolCalls,
    List<String>? responses,
    String? status,
  }) {
    return AgentTranscriptTurn(
      id: id ?? this.id,
      stepIndex: stepIndex ?? this.stepIndex,
      timestamp: timestamp ?? this.timestamp,
      userInput: userInput ?? this.userInput,
      thinking: thinking ?? this.thinking,
      toolCalls: toolCalls ?? this.toolCalls,
      responses: responses ?? this.responses,
      status: status ?? this.status,
    );
  }

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
