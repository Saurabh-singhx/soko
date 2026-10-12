import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';
import '../widgets/glass_card.dart';

/// High-Speed File Transfer & APK Sender Screen.
class FileShareScreen extends StatefulWidget {
  final VoidCallback onBack;

  const FileShareScreen({super.key, required this.onBack});

  @override
  State<FileShareScreen> createState() => _FileShareScreenState();
}

class _FileShareScreenState extends State<FileShareScreen> {
  bool isTransferring = false;
  double transferProgress = 0.0;
  String? activeFilename;

  void simulateApkTransfer() {
    setState(() {
      isTransferring = true;
      activeFilename = 'soko-v1.0.0-release.apk';
      transferProgress = 0.0;
    });

    // Simulate 50MB APK transferring over mobile hotspot in ~1.2s
    var progress = 0.0;
    Future.doWhile(() async {
      await Future.delayed(const Duration(milliseconds: 150));
      progress += 0.25;
      if (mounted) {
        setState(() {
          transferProgress = progress.clamp(0.0, 1.0);
        });
      }
      if (progress >= 1.0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('APK transferred successfully to Desktop!'),
              backgroundColor: GlassTheme.emeraldAccent,
            ),
          );
          setState(() {
            isTransferring = false;
          });
        }
        return false;
      }
      return true;
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
          'Hotspot File Transfer',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          children: [
            // Hotspot Network Information Card
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: GlassTheme.cyanAccent.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.wifi_tethering_rounded, color: GlassTheme.cyanAccent, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Mobile Hotspot LAN Mode',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          Text(
                            'Gateway: 192.168.43.1 • Zero Data Burn',
                            style: TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'When connected to this hotspot, files transfer directly over hardware Wi-Fi at 30–60 MB/s without consuming cellular mobile data.',
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Select & Send APK Card
            GlassCard(
              opacity: 0.12,
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: GlassTheme.cyanAccent.withOpacity(0.15),
                      border: Border.all(color: GlassTheme.cyanAccent.withOpacity(0.3)),
                    ),
                    child: const Icon(Icons.android_rounded, color: GlassTheme.cyanAccent, size: 32),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Share Build APK',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Instant handoff to desktop Dynamic Island',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                  ),
                  const SizedBox(height: 24),

                  if (isTransferring) ...[
                    LinearProgressIndicator(
                      value: transferProgress,
                      backgroundColor: Colors.white10,
                      valueColor: const AlwaysStoppedAnimation(GlassTheme.cyanAccent),
                      minHeight: 6,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          activeFilename ?? 'Transferring...',
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'monospace'),
                        ),
                        Text(
                          '${(transferProgress * 100).toInt()}%',
                          style: const TextStyle(color: GlassTheme.cyanAccent, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ] else ...[
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: GlassTheme.cyanAccent,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.send_rounded, size: 18),
                      label: const Text('Send Test APK (52 MB)', style: TextStyle(fontWeight: FontWeight.bold)),
                      onPressed: simulateApkTransfer,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
