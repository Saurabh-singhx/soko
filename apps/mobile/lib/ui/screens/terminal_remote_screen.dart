import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';
import '../widgets/glass_card.dart';

/// Remote Terminal screen for controlling CLI developer agents.
class TerminalRemoteScreen extends StatefulWidget {
  final VoidCallback onBack;

  const TerminalRemoteScreen({super.key, required this.onBack});

  @override
  State<TerminalRemoteScreen> createState() => _TerminalRemoteScreenState();
}

class _TerminalRemoteScreenState extends State<TerminalRemoteScreen> {
  bool isRunning = false;
  final List<String> logs = [
    'Soko Remote CLI Client connected.',
    'Ready to dispatch whitelisted commands to desktop daemon.',
  ];

  void triggerCommand(String alias, String label) {
    setState(() {
      isRunning = true;
      logs.add('\n\$ $alias');
      logs.add('Spawning process with isolated arguments...');
      logs.add('[Desktop] Desktop Dynamic Island switched to CLI mode.');
    });

    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) {
        setState(() {
          logs.add('[agy] Initializing Antigravity autonomous agent session...');
          logs.add('[agy] Active workspace: /home/saurabh/coding/soko');
          logs.add('[agy] Checking git tree and staged changes... OK');
        });
      }
    });

    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted) {
        setState(() {
          logs.add('[agy] Agent tasks verified. Process exited with code 0.');
          isRunning = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GlassTheme.bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: widget.onBack,
        ),
        title: const Text(
          'Remote Terminal',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          children: [
            // Command Trigger Strip
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GlassTheme.cyanAccent.withOpacity(0.2),
                      foregroundColor: GlassTheme.cyanAccent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.play_arrow_rounded, size: 16),
                    label: const Text('agy status'),
                    onPressed: isRunning ? null : () => triggerCommand('agy status', 'Check Status'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GlassTheme.amberAccent.withOpacity(0.2),
                      foregroundColor: GlassTheme.amberAccent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.auto_mode_rounded, size: 16),
                    label: const Text('agy run'),
                    onPressed: isRunning ? null : () => triggerCommand('agy run', 'Run Agent'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white10,
                      foregroundColor: Colors.white70,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('git pull'),
                    onPressed: isRunning ? null : () => triggerCommand('git pull origin main', 'Git Pull'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Live Monospace Terminal Screen
            Expanded(
              child: GlassCard(
                opacity: 0.12,
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(width: 10, height: 10, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFF5F56))),
                            const SizedBox(width: 6),
                            Container(width: 10, height: 10, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFFBD2E))),
                            const SizedBox(width: 6),
                            Container(width: 10, height: 10, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF27C93F))),
                            const SizedBox(width: 12),
                            Text(
                              'bash — pty stream',
                              style: TextStyle(color: Colors.white.withOpacity(0.4), fontFamily: 'monospace', fontSize: 11),
                            ),
                          ],
                        ),
                        if (isRunning)
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: GlassTheme.cyanAccent),
                          ),
                      ],
                    ),
                    const Divider(color: Colors.white10, height: 24),
                    Expanded(
                      child: ListView.builder(
                        itemCount: logs.length,
                        itemBuilder: (context, index) {
                          final line = logs[index];
                          final isCmd = line.startsWith('\$');
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2.0),
                            child: Text(
                              line,
                              style: TextStyle(
                                color: isCmd ? GlassTheme.cyanAccent : Colors.white70,
                                fontFamily: 'monospace',
                                fontSize: 12,
                                fontWeight: isCmd ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                          );
                        },
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
}
