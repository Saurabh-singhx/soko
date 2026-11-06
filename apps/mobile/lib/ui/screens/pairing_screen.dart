import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';
import '../../services/bluetooth/ble_service.dart';
import '../../services/pairing/universal_qr_parser.dart';
import '../widgets/glass_card.dart';
import 'qr_scanner/qr_scanner_view.dart';

/// Bluetooth & Universal QR Pairing & Security Verification Screen.
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
  String activeSasPin = '482 195';
  bool _isScannerActive = false;
  String? _connectedHost;

  void _handleScannedPayload(ParsedQrPayload payload) {
    if (!payload.isValid) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(payload.error ?? 'Invalid QR code scanned'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() {
      if (payload.formattedPin != null) {
        activeSasPin = payload.formattedPin!;
      }
      _connectedHost = payload.host;
      _isScannerActive = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Instant QR Paired with ${payload.workstationName ?? payload.host ?? "Desktop"}! PIN: $activeSasPin'),
        backgroundColor: GlassTheme.emeraldAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = widget.bleService.status == MobileBleStatus.connected;

    if (_isScannerActive) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close_rounded, color: Colors.white),
            onPressed: () => setState(() => _isScannerActive = false),
          ),
          title: const Text(
            'Scan Dynamic Island QR',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
        body: QrScannerView(
          onScanned: _handleScannedPayload,
          onManualPinTap: () => setState(() => _isScannerActive = false),
        ),
      );
    }

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
          'Device Pairing',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          children: [
            // Instant QR Code Camera Scanner Action Card
            GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: InkWell(
                onTap: () => setState(() => _isScannerActive = true),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: GlassTheme.purpleAccent.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: GlassTheme.purpleAccent.withOpacity(0.35)),
                      ),
                      child: const Icon(Icons.qr_code_scanner_rounded, color: GlassTheme.purpleAccent, size: 24),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Scan Desktop QR Code',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          Text(
                            'Universal 1-tap instant handshake via camera',
                            style: TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: GlassTheme.cyanAccent.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: GlassTheme.cyanAccent.withOpacity(0.3)),
                      ),
                      child: const Text(
                        'SCAN',
                        style: TextStyle(color: GlassTheme.cyanAccent, fontWeight: FontWeight.bold, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

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
                    _connectedHost != null
                      ? 'Connected to Workstation host: $_connectedHost'
                      : 'Ensure this 6-digit number matches the PIN displayed on your Desktop Dynamic Island.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

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
                          "Soko Desktop HUD",
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        Text(
                          isConnected ? 'Connected & Verified' : 'mDNS / LAN Ready (_soko._tcp.local)',
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
