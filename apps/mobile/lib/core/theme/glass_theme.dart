import 'dart:ui';
import 'package:flutter/material.dart';

/// Design system tokens for Soko's Glassmorphic Dark UI.
class GlassTheme {
  // Background gradient colors
  static const Color bgDark = Color(0xFF09090D);
  static const Color bgElevated = Color(0xFF13131A);

  // Neon accent colors
  static const Color cyanAccent = Color(0xFF00F0FF);
  static const Color purpleAccent = Color(0xFF8B5CF6);
  static const Color amberAccent = Color(0xFFF59E0B);
  static const Color emeraldAccent = Color(0xFF10B981);
  static const Color roseAccent = Color(0xFFF43F5E);

  // Frosted glass constants
  static const double defaultBlurSigma = 16.0;
  static const double cardBorderRadius = 24.0;

  /// Frosted glass decoration container.
  static BoxDecoration glassBoxDecoration({
    double opacity = 0.08,
    double borderOpacity = 0.15,
    Color borderColor = Colors.white,
    double borderRadius = cardBorderRadius,
    List<BoxShadow>? shadows,
  }) {
    return BoxDecoration(
      color: Colors.white.withOpacity(opacity),
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: borderColor.withOpacity(borderOpacity),
        width: 1.0,
      ),
      boxShadow: shadows ??
          [
            BoxShadow(
              color: Colors.black.withOpacity(0.35),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
    );
  }

  /// High-impact animated gradient for background mesh.
  static const RadialGradient backgroundMesh = RadialGradient(
    center: Alignment(-0.6, -0.6),
    radius: 1.4,
    colors: [
      Color(0xFF1A1A2E),
      Color(0xFF0D0D15),
      Color(0xFF070709),
    ],
  );
}
