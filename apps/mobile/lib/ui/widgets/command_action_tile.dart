import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';
import 'glass_card.dart';

/// Command tile for triggering whitelisted CLI agents from the mobile deck.
class CommandActionTile extends StatelessWidget {
  final String title;
  final String commandString;
  final IconData icon;
  final Color iconColor;
  final bool requiresBiometrics;
  final VoidCallback onTrigger;

  const CommandActionTile({
    super.key,
    required this.title,
    required this.commandString,
    required this.icon,
    this.iconColor = GlassTheme.amberAccent,
    this.requiresBiometrics = false,
    required this.onTrigger,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      onTap: onTrigger,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: iconColor.withOpacity(0.3)),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    if (requiresBiometrics) ...[
                      const SizedBox(width: 6),
                      const Icon(
                        Icons.fingerprint,
                        color: GlassTheme.purpleAccent,
                        size: 14,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  commandString,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.5),
                    fontFamily: 'monospace',
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.play_arrow_rounded,
              color: Colors.white70,
              size: 18,
            ),
          ),
        ],
      ),
    );
  }
}
