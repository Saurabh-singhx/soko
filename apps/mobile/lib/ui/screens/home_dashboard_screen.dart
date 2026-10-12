import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';
import '../../services/bluetooth/ble_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/reactive_mascot.dart';
import '../widgets/command_action_tile.dart';

/// Main Glassmorphic Dashboard screen.
class HomeDashboardScreen extends StatelessWidget {
  final MobileBleService bleService;
  final VoidCallback onOpenTerminal;
  final VoidCallback onOpenFileShare;
  final VoidCallback onOpenPairing;

  const HomeDashboardScreen({
    super.key,
    required this.bleService,
    required this.onOpenTerminal,
    required this.onOpenFileShare,
    required this.onOpenPairing,
  });

  @override
  Widget build(BuildContext context) {
    final isConnected = bleService.status == MobileBleStatus.connected;

    return Scaffold(
      backgroundColor: GlassTheme.bgDark,
      body: Stack(
        children: [
          // Background Glow Orbs
          Positioned(
            top: -60,
            right: -60,
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: GlassTheme.cyanAccent.withOpacity(0.12),
              ),
            ),
          ),
          Positioned(
            bottom: 120,
            left: -80,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: GlassTheme.purpleAccent.withOpacity(0.10),
              ),
            ),
          ),

          SafeArea(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              children: [
                // Header Bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SOKO',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                        ),
                        Text(
                          'Dynamic Desktop Companion',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.5),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.bluetooth, color: Colors.white70),
                      onPressed: onOpenPairing,
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Hero Mascot & Connection Card
                GlassCard(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      ReactiveMascotWidget(
                        size: 80,
                        isConnected: isConnected,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        isConnected ? 'Connected to Desktop' : 'Searching for Desktop...',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isConnected
                            ? (bleService.connectedDeviceName ?? 'Linux / Windows Host')
                            : 'Ensure Bluetooth is enabled on both devices',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.6),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isConnected
                              ? GlassTheme.emeraldAccent.withOpacity(0.15)
                              : Colors.amber.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isConnected
                                ? GlassTheme.emeraldAccent.withOpacity(0.3)
                                : Colors.amber.withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isConnected
                                    ? GlassTheme.emeraldAccent
                                    : Colors.amber,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              isConnected ? 'Dynamic Island Active' : 'Standby Mode',
                              style: TextStyle(
                                color: isConnected
                                    ? GlassTheme.emeraldAccent
                                    : Colors.amber,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Quick Action Grid
                Row(
                  children: [
                    Expanded(
                      child: GlassCard(
                        padding: const EdgeInsets.all(18),
                        onTap: onOpenFileShare,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: GlassTheme.cyanAccent.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.bolt_rounded,
                                color: GlassTheme.cyanAccent,
                                size: 22,
                              ),
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'Send APK',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Hotspot 50 MB/s',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: GlassCard(
                        padding: const EdgeInsets.all(18),
                        onTap: onOpenTerminal,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: GlassTheme.amberAccent.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.terminal_rounded,
                                color: GlassTheme.amberAccent,
                                size: 22,
                              ),
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'CLI Agent',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Antigravity runner',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Whitelisted CLI Actions Deck
                const Text(
                  'Quick Commands',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),

                CommandActionTile(
                  title: 'Antigravity CLI Status',
                  commandString: '\$ agy status',
                  icon: Icons.memory_rounded,
                  iconColor: GlassTheme.cyanAccent,
                  onTrigger: onOpenTerminal,
                ),
                const SizedBox(height: 10),

                CommandActionTile(
                  title: 'Autonomous Goal Run',
                  commandString: '\$ agy run',
                  icon: Icons.auto_awesome_rounded,
                  iconColor: GlassTheme.purpleAccent,
                  requiresBiometrics: true,
                  onTrigger: onOpenTerminal,
                ),
                const SizedBox(height: 10),

                CommandActionTile(
                  title: 'Lock Desktop Screen',
                  commandString: '\$ loginctl lock-session',
                  icon: Icons.lock_outline_rounded,
                  iconColor: GlassTheme.roseAccent,
                  onTrigger: () {
                    // Lock PC trigger
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
