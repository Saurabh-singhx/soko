import 'package:flutter/material.dart';
import '../../features/agent_terminal/ui/agent_terminal_view.dart';
import '../../features/agent_terminal/services/agent_remote_service.dart';

/// Remote Terminal screen for controlling and monitoring live CLI / Antigravity agents.
class TerminalRemoteScreen extends StatelessWidget {
  final VoidCallback onBack;
  final AgentRemoteService? service;

  const TerminalRemoteScreen({
    super.key,
    required this.onBack,
    this.service,
  });

  @override
  Widget build(BuildContext context) {
    return AgentTerminalView(
      onBack: onBack,
      service: service,
    );
  }
}
