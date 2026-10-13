import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';

/// Colorful "Nova" Cyber-Critter mascot on mobile.
///
/// Features animated ear-antennae fins, aurora gradients, and glowing specular eyes.
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
      angle: isConnected ? -0.06 : 0.0, // Quirky Grokbot head tilt
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
          // 1. Ambient Background Pulse Halo
          Container(
            width: size * 0.9,
            height: size * 0.9,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: isConnected
                      ? GlassTheme.cyanAccent.withOpacity(0.35)
                      : Colors.white12,
                  blurRadius: 28,
                  spreadRadius: 4,
                ),
              ],
            ),
          ),

          // 2. Left Glowing Ear-Fin
          Positioned(
            left: 2,
            top: size * 0.18,
            child: Transform.rotate(
              angle: -0.25,
              child: Container(
                width: size * 0.22,
                height: size * 0.35,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [GlassTheme.purpleAccent, GlassTheme.bgDark],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isConnected ? GlassTheme.cyanAccent : Colors.white24,
                    width: 1.5,
                  ),
                ),
              ),
            ),
          ),

          // 3. Right Glowing Ear-Fin
          Positioned(
            right: 2,
            top: size * 0.18,
            child: Transform.rotate(
              angle: 0.25,
              child: Container(
                width: size * 0.22,
                height: size * 0.35,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [GlassTheme.purpleAccent, GlassTheme.bgDark],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isConnected ? GlassTheme.cyanAccent : Colors.white24,
                    width: 1.5,
                  ),
                ),
              ),
            ),
          ),

          // 4. Main Obsidian Visor Dome
          Container(
            width: size * 0.76,
            height: size * 0.76,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const RadialGradient(
                center: Alignment(-0.2, -0.3),
                radius: 1.1,
                colors: [
                  Color(0xFF26203A),
                  Color(0xFF14141F),
                  Color(0xFF09090D),
                ],
              ],
              border: Border.all(
                color: isConnected ? GlassTheme.cyanAccent : Colors.white30,
                width: 2.0,
              ),
            ),
            child: Stack(
              children: [
                // Visor Glass Specular Sheen
                Positioned(
                  top: 4,
                  left: 10,
                  right: 10,
                  height: size * 0.25,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: LinearGradient(
                        colors: [
                          Colors.white.withOpacity(0.25),
                          Colors.transparent,
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ),

                // Chromatic Cheeks (Blush)
                Positioned(
                  bottom: size * 0.22,
                  left: 8,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isConnected
                          ? GlassTheme.purpleAccent.withOpacity(0.45)
                          : Colors.transparent,
                    ),
                  ),
                ),
                Positioned(
                  bottom: size * 0.22,
                  right: 8,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isConnected
                          ? GlassTheme.purpleAccent.withOpacity(0.45)
                          : Colors.transparent,
                    ),
                  ),
                ),

                // Luminous Neon Eyes & Smile
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _buildEye(isConnected),
                          const SizedBox(width: 14),
                          _buildEye(isConnected),
                        ],
                      ),
                      const SizedBox(height: 5),
                      // Soft Curvature Smile
                      Text(
                        isConnected ? '◡' : '─',
                        style: TextStyle(
                          color: isConnected ? Colors.white : Colors.white38,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
  }

  Widget _buildEye(bool active) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active ? Colors.white : Colors.white54,
        boxShadow: active
            ? [
                const BoxShadow(
                  color: GlassTheme.cyanAccent,
                  blurRadius: 6,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
      child: active
          ? Align(
              alignment: Alignment.topRight,
              child: Container(
                width: 3.5,
                height: 3.5,
                margin: const EdgeInsets.all(1.5),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: GlassTheme.cyanAccent,
                ),
              ),
            )
          : null,
    );
  }
}
