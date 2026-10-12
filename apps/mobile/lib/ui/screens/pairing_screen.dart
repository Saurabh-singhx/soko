import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';
import '../../services/bluetooth/ble_service.dart';
import '../widgets/glass_card.dart';

/// Bluetooth Pairing & Security Verification Screen.
class PairingScreen extends StatefulWidget {
  final MobileBleService bleService;
  final VoidCallback onBack;

  const PairingScreen({
    super.key,
    required this.bleService,
    required this.onBack,
  });

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final String activeSasPin = '482 195';

  @override
  Widget build(BuildContext context) {
    final isConnected = widget.bleService.status == MobileBleStatus.connected;

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
          'Bluetooth Pairing',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          children: [
            // Security PIN Card
            GlassCard(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Text(
                    'SECURITY CONFIRMATION PIN',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: GlassTheme.cyanAccent.withOpacity(0.3)),
                    ),
                    child: Text(
                      activeSasPin,
                      style: const TextStyle(
                        color: GlassTheme.cyanAccent,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                        letterSpacing: 4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Ensure this 6-digit number matches the PIN displayed on your Desktop Dynamic Island.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Discovered Desktop Device Card
            GlassCard(
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: GlassTheme.cyanAccent.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.desktop_windows_rounded, color: GlassTheme.cyanAccent, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Saurabh's Desktop",
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        Text(
                          isConnected ? 'Connected & Verified' : 'Available for Pairing',
                          style: TextStyle(
                            color: isConnected ? GlassTheme.emeraldAccent : Colors.white54,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isConnected ? Colors.white10 : GlassTheme.cyanAccent,
                      foregroundColor: isConnected ? Colors.white70 : Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 0,
                    ),
                    onPressed: () {
                      if (isConnected) {
                        widget.bleService.disconnect();
                      } else {
                        widget.bleService.startScan();
                      }
                    },
                    child: Text(isConnected ? 'Disconnect' : 'Connect'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
