import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';

/// Reactive animated mascot widget on mobile.
class ReactiveMascotWidget extends StatelessWidget {
  final double size;
  final bool isConnected;

  const ReactiveMascotWidget({
    super.key,
    this.size = 72,
    this.isConnected = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [
            Color(0xFF2A2A38),
            Color(0xFF121218),
          ],
        ),
        border: Border.all(
          color: isConnected ? GlassTheme.cyanAccent : Colors.white24,
          width: 2.0,
        ),
        boxShadow: [
          BoxShadow(
            color: isConnected
                ? GlassTheme.cyanAccent.withOpacity(0.3)
                : Colors.transparent,
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Center(
        child: isConnected
            ? const Text(
                '● ◡ ●',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              )
            : const Text(
                '• _ •',
                style: TextStyle(
                  color: Colors.white60,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
      ),
    );
  }
}
