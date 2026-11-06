import 'package:flutter/material.dart';
import '../../../core/theme/glass_theme.dart';
import '../../../services/pairing/universal_qr_parser.dart';

/// Glassmorphic QR Scanner Viewport with Reticle and Laser Beam.
///
/// Designed to scan both Universal Web URLs (Option 3) and native soko:// deep links.
class QrScannerView extends StatefulWidget {
  final ValueChanged<ParsedQrPayload> onScanned;
  final VoidCallback onManualPinTap;

  const QrScannerView({
    super.key,
    required this.onScanned,
    required this.onManualPinTap,
  });

  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> with SingleTickerProviderStateMixin {
  late AnimationController _beamController;
  late Animation<double> _beamAnimation;
  bool _isTorchOn = false;

  @override
  void initState() {
    super.initState();
    _beamController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

    _beamAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _beamController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _beamController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final boxSize = constraints.maxWidth * 0.72;

        return Stack(
          alignment: Alignment.center,
          children: [
            // Darkened Vignette Overlay
            Container(
              color: Colors.black.withOpacity(0.75),
            ),

            // Viewfinder Center Cutout
            Center(
              child: Container(
                width: boxSize,
                height: boxSize,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.12), width: 1.5),
                  color: Colors.transparent,
                ),
                child: Stack(
                  children: [
                    // Corner Target Accents (Cyan Neon)
                    ..._buildCornerAccents(),

                    // Animated Laser Scanning Beam
                    AnimatedBuilder(
                      animation: _beamAnimation,
                      builder: (context, child) {
                        return Positioned(
                          top: _beamAnimation.value * (boxSize - 16) + 8,
                          left: 12,
                          right: 12,
                          child: Container(
                            height: 2.5,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  GlassTheme.cyanAccent.withOpacity(0.8),
                                  GlassTheme.cyanAccent,
                                  GlassTheme.cyanAccent.withOpacity(0.8),
                                  Colors.transparent,
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: GlassTheme.cyanAccent.withOpacity(0.7),
                                  blurRadius: 10,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),

            // Guidance Instruction Text
            Positioned(
              bottom: constraints.maxHeight * 0.22,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.qr_code_scanner_rounded, color: GlassTheme.cyanAccent, size: 16),
                        SizedBox(width: 8),
                        Text(
                          'Align Desktop Dynamic Island QR within frame',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Handshake completes automatically without typing PIN',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11),
                  ),
                ],
              ),
            ),

            // Bottom Action Controls (Torch & Manual PIN Fallback)
            Positioned(
              bottom: 28,
              left: 24,
              right: 24,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Torch Toggle Button
                  InkWell(
                    onTap: () {
                      setState(() {
                        _isTorchOn = !_isTorchOn;
                      });
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: _isTorchOn ? GlassTheme.cyanAccent.withOpacity(0.2) : Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: _isTorchOn ? GlassTheme.cyanAccent : Colors.white.withOpacity(0.12),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                            color: _isTorchOn ? GlassTheme.cyanAccent : Colors.white70,
                            size: 18,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _isTorchOn ? 'Flash On' : 'Flash Off',
                            style: TextStyle(
                              color: _isTorchOn ? Colors.white : Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Manual 6-Digit PIN Fallback Button
                  InkWell(
                    onTap: widget.onManualPinTap,
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white.withOpacity(0.12)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.pin_rounded, color: Colors.white70, size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Enter PIN Manually',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  List<Widget> _buildCornerAccents() {
    const cornerSize = 22.0;
    const stroke = 3.5;
    const color = GlassTheme.cyanAccent;

    return [
      // Top-Left
      Positioned(
        top: 0,
        left: 0,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              top: BorderSide(color: color, width: stroke),
              left: BorderSide(color: color, width: stroke),
            ),
            borderRadius: BorderRadius.only(topLeft: Radius.circular(12)),
          ),
        ),
      ),
      // Top-Right
      Positioned(
        top: 0,
        right: 0,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              top: BorderSide(color: color, width: stroke),
              right: BorderSide(color: color, width: stroke),
            ),
            borderRadius: BorderRadius.only(topRight: Radius.circular(12)),
          ),
        ),
      ),
      // Bottom-Left
      Positioned(
        bottom: 0,
        left: 0,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: color, width: stroke),
              left: BorderSide(color: color, width: stroke),
            ),
            borderRadius: BorderRadius.only(bottomLeft: Radius.circular(12)),
          ),
        ),
      ),
      // Bottom-Right
      Positioned(
        bottom: 0,
        right: 0,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: color, width: stroke),
              right: BorderSide(color: color, width: stroke),
            ),
            borderRadius: BorderRadius.only(bottomRight: Radius.circular(12)),
          ),
        ),
      ),
    ];
  }
}
