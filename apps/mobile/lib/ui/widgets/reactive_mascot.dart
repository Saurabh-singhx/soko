import 'package:flutter/material.dart';

/// Monochrome "Grok-Bot" Mascot Widget on mobile.
///
/// Features high-contrast Black & White aesthetics, dynamic capsule eyes,
/// and aerodynamic ear-antennae fins.
class ReactiveMascotWidget extends StatelessWidget {
  final double size;
  final bool isConnected;

  const ReactiveMascotWidget({
    super.key,
    this.size = 84,
    this.isConnected = true,
  });

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: isConnected ? -0.05 : 0.0, // Quirky curious Grok tilt
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // 1. Ambient Monochrome Pulse Halo
            Container(
              width: size * 0.9,
              height: size * 0.9,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: isConnected
                        ? Colors.white.withOpacity(0.18)
                        : Colors.white.withOpacity(0.05),
                    blurRadius: 24,
                    spreadRadius: 2,
                  ),
                ],
              ),
            ),

            // 2. Left Monochrome Ear-Fin
            Positioned(
              left: 2,
              top: size * 0.18,
              child: Transform.rotate(
                angle: -0.28,
                child: Container(
                  width: size * 0.22,
                  height: size * 0.35,
                  decoration: BoxDecoration(
                    color: const Color(0xFF141418),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isConnected ? Colors.white70 : Colors.white24,
                      width: 1.4,
                    ),
                  ),
                ),
              ),
            ),

            // 3. Right Monochrome Ear-Fin
            Positioned(
              right: 2,
              top: size * 0.18,
              child: Transform.rotate(
                angle: 0.28,
                child: Container(
                  width: size * 0.22,
                  height: size * 0.35,
                  decoration: BoxDecoration(
                    color: const Color(0xFF141418),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isConnected ? Colors.white70 : Colors.white24,
                      width: 1.4,
                    ),
                  ),
                ),
              ),
            ),

            // 4. Pure OLED Black Visor Dome
            Container(
              width: size * 0.76,
              height: size * 0.76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF000000),
                border: Border.all(
                  color: isConnected ? Colors.white.withOpacity(0.4) : Colors.white24,
                  width: 1.8,
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black,
                    blurRadius: 16,
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Subtle Curved Specular Glass Rim
                  Positioned(
                    top: 6,
                    child: Container(
                      width: size * 0.42,
                      height: 2,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),

                  // Grok Bot Geometric White Eye Capsules (Aligned to bottom baseline)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _buildGrokEye(isConnected, isLeft: true),
                      const SizedBox(width: 10),
                      _buildGrokEye(isConnected, isLeft: false),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGrokEye(bool active, {required bool isLeft}) {
    return Container(
      width: 8,
      height: isLeft ? 18 : 16, // Asymmetric curious height
      decoration: BoxDecoration(
        color: active ? Colors.white : Colors.white54,
        borderRadius: BorderRadius.circular(4),
        boxShadow: active
            ? [
                BoxShadow(
                  color: Colors.white.withOpacity(0.7),
                  blurRadius: 6,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
    );
  }
}
